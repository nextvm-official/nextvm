import { join } from 'node:path'
import { defaultIo } from './default-io'
import { linkModules, type LinkResult } from './linker'
import { generateServerCfg } from './server-cfg'
import { resolveFxserverBinary, spawnFxserver } from './subprocess'
import type {
	RunnerIo,
	RunnerOptions,
	RunnerState,
	SpawnedProcess,
} from './types'

/**
 * FxserverRunner — orchestrates the lifecycle of a local FXServer
 * subprocess for NextVM development.
 *
 * State machine:
 *
 *   idle → starting → running → stopping → stopped
 *
 * Each transition is guarded — calling `stop()` on an already-stopped
 * runner is a no-op, calling `ensure()` on a runner that hasn't
 * started throws.
 *
 * The runner is constructed once and used until disposal. Re-using a
 * stopped runner requires creating a new instance.
 */
export class FxserverRunner {
	private state: RunnerState = 'idle'
	private process: SpawnedProcess | null = null
	private linkResult: LinkResult | null = null
	private generatedCfgPath: string | null = null
	private lockPath: string | null = null
	private readonly io: RunnerIo

	constructor(private readonly opts: RunnerOptions) {
		this.io = opts.io ?? defaultIo
	}

	/** Current state — read by tests + dev tooling */
	getState(): RunnerState {
		return this.state
	}

	/** Last spawned PID, or null if the process is not running */
	getPid(): number | null {
		return this.process?.pid ?? null
	}

	/**
	 * Boot the FXServer:
	 *
	 *   1. Resolve the FXServer binary path
	 *   2. Link modules into resources/[nextvm]/
	 *   3. Generate server.cfg.nextvm
	 *   4. Spawn the subprocess with `+exec server.cfg.nextvm`
	 *   5. Wire stdout/stderr → onLog
	 *
	 * Throws if the runner is not in `idle` state.
	 */
	async start(): Promise<void> {
		if (this.state !== 'idle') {
			throw new Error(
				`FxserverRunner.start() called in state "${this.state}". ` +
					`A runner instance can only be started once.`,
			)
		}
		this.state = 'starting'

		// Data dir defaults to the binary dir (all-in-one layout). When
		// the user has a split layout (server/ + server-data/), they pass
		// fxserverDataPath pointing at the data root.
		const dataPath = this.opts.fxserverDataPath ?? this.opts.fxserverPath

		try {
			// 0. Lockfile — refuse to start if another runner is already
			// using this FXServer install. Stale locks (process gone)
			// are silently reclaimed.
			this.lockPath = join(dataPath, '.nextvm.lock')
			if (this.io.existsSync(this.lockPath)) {
				const raw = this.io.readFileSync(this.lockPath).trim()
				const otherPid = Number.parseInt(raw, 10)
				if (Number.isFinite(otherPid) && this.io.isProcessAlive(otherPid)) {
					this.lockPath = null
					throw new Error(
						`Another NextVM runner is already managing this FXServer ` +
							`(PID ${otherPid}, lockfile at ${join(dataPath, '.nextvm.lock')}). ` +
							`Stop it first, or delete the lockfile if you're sure it's stale.`,
					)
				}
				this.log(`Reclaiming stale lockfile (PID ${raw} not alive)`)
				this.io.rmSync(this.lockPath, { recursive: true, force: true })
			}

			// 1. Resolve binary first so we fail fast on bad paths
			const binary = resolveFxserverBinary(
				this.opts.fxserverPath,
				this.io.platform,
				(p) => this.io.existsSync(p),
			)
			this.log(`Resolved FXServer binary: ${binary}`)

			// 2. Link modules into the data dir's resources/[nextvm]/
			this.linkResult = linkModules({
				fxserverPath: dataPath,
				modules: this.opts.modules,
				io: this.io,
			})
			this.log(
				`Linked ${this.linkResult.links.size} module(s) ` +
					`(${this.linkResult.usedSymlinks ? 'symlinks' : 'copies'})`,
			)

			// 3. Generate server.cfg.nextvm. We auto-inject the absolute
			// dev-trigger path so the runtime-server's bridge inside
			// FXServer can find it via GetConvar regardless of cwd.
			const cfgContents = generateServerCfg({
				...this.opts.serverCfg,
				modules: this.opts.modules,
				devTriggerPath:
					this.opts.serverCfg.devTriggerPath ??
					join(this.opts.projectRoot, '.nextvm', 'dev-trigger.json'),
			})
			this.generatedCfgPath = join(dataPath, 'server.cfg.nextvm')
			this.io.writeFileSync(this.generatedCfgPath, cfgContents)
			this.log(`Wrote ${this.generatedCfgPath}`)

			// 4. Spawn subprocess — cwd MUST be the data dir so FXServer
			// resolves `resources/` relatively.
			this.process = spawnFxserver({
				binary,
				cwd: dataPath,
				configFile: this.generatedCfgPath,
				io: this.io,
				onLog: (line) => this.opts.onLog?.(line, 'fxserver'),
				onExit: (code) => this.handleExit(code),
				onError: (err) => this.log(`FXServer process error: ${err.message}`),
			})

			if (this.process.pid !== undefined) {
				this.log(`FXServer started (PID ${this.process.pid})`)
				// Write lockfile after spawn so the PID is real.
				this.io.writeFileSync(this.lockPath, String(this.process.pid))
			}
			this.state = 'running'
		} catch (err) {
			// Roll back any partial setup so the runner is not left in
			// an inconsistent state.
			this.linkResult?.cleanup()
			this.linkResult = null
			if (this.lockPath && this.io.existsSync(this.lockPath)) {
				this.io.rmSync(this.lockPath, { recursive: true, force: true })
			}
			this.lockPath = null
			this.state = 'stopped'
			throw err
		}
	}

	/**
	 * Stop the FXServer cleanly:
	 *
	 *   1. Send SIGTERM to the subprocess
	 *   2. Wait up to `gracePeriodMs` for it to exit (default 5s)
	 *   3. Force-kill with SIGKILL if it didn't exit in time
	 *   4. Remove all symlinks/copies created by start()
	 *   5. Leave server.cfg.nextvm in place (it's safe to overwrite next time)
	 *
	 * Idempotent — calling stop on an already-stopped runner is a no-op.
	 */
	async stop(gracePeriodMs = 5000): Promise<void> {
		if (this.state === 'stopped') return
		if (this.state === 'idle') {
			this.state = 'stopped'
			return
		}
		this.state = 'stopping'

		const proc = this.process
		if (proc) {
			try {
				proc.kill('SIGTERM')
			} catch {
				// Process may have already exited — ignore
			}

			// Wait for the process to actually exit before cleanup, so we
			// don't try to remove symlinks while FXServer still has them
			// open (Windows would error).
			await new Promise<void>((resolve) => {
				const timer = setTimeout(() => {
					try {
						proc.kill('SIGKILL')
					} catch {
						// already gone
					}
					resolve()
				}, gracePeriodMs)
				proc.on('exit', () => {
					clearTimeout(timer)
					resolve()
				})
			})
		}

		this.linkResult?.cleanup()
		this.linkResult = null
		if (this.lockPath && this.io.existsSync(this.lockPath)) {
			this.io.rmSync(this.lockPath, { recursive: true, force: true })
		}
		this.lockPath = null
		this.process = null
		this.state = 'stopped'
		this.log('FXServer stopped, symlinks removed')
	}

	/**
	 * Trigger an `ensure <name>` inside the running FXServer.
	 *
	 * Sends the command directly via FXServer's stdin pipe, which
	 * the console accepts with full admin ACL. This avoids any
	 * fs.watch-based bridge inside the FXServer process (which caused
	 * SIGSEGV crashes when the V8 isolate was destroyed on ensure).
	 */
	ensure(moduleName: string): void {
		if (this.state !== 'running') {
			throw new Error(
				`FxserverRunner.ensure(${moduleName}) called in state "${this.state}". ` +
					`The runner must be running.`,
			)
		}

		if (!this.process) {
			throw new Error('FxserverRunner.ensure() called but no subprocess is running.')
		}

		this.process.stdin.write(`ensure ${moduleName}\n`)
		this.log(`ensure ${moduleName} (via stdin)`)
	}

	private handleExit(code: number | null): void {
		if (this.state === 'stopping' || this.state === 'stopped') {
			// Expected — we initiated the shutdown
			return
		}
		this.log(`FXServer exited unexpectedly (code ${code ?? 'null'})`)
		this.state = 'stopped'
		this.linkResult?.cleanup()
		this.linkResult = null
		if (this.lockPath && this.io.existsSync(this.lockPath)) {
			this.io.rmSync(this.lockPath, { recursive: true, force: true })
		}
		this.lockPath = null
		this.process = null
		this.opts.onExit?.(code)
	}

	private log(line: string): void {
		this.opts.onLog?.(line, 'runner')
	}
}
