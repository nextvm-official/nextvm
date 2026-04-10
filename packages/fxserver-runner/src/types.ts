/**
 * Public types for @nextvm/fxserver-runner.
 *
 * The runner is intentionally decoupled from @nextvm/build's
 * `LoadedProject` type so it can be unit-tested without dragging the
 * full build pipeline into every test. Consumers (the CLI's `serve`
 * command) translate from `LoadedProject` to `RunnerModule` at the
 * boundary.
 */

export interface RunnerModule {
	/** Module name as it will appear in `ensure <name>` */
	name: string
	/** Absolute path to the module folder containing dist/ + fxmanifest.lua */
	path: string
}

export interface ServerCfgInput {
	/** Display name shown in the FiveM server browser */
	hostname: string
	/** Max client slots */
	maxClients: number
	/** TCP/UDP endpoint, default `0.0.0.0:30120` */
	endpoint: string
	/** Optional CFX license key — read from env, never written verbatim */
	licenseKey?: string
	/** Game build to enforce, default 3095 */
	gameBuild?: number
	/** Modules in dependency order — every entry becomes an `ensure` line */
	modules: readonly RunnerModule[]
	/** Extra resources to ensure alongside the framework modules */
	additionalResources?: readonly string[]
	/** Free-form `set <key> <value>` convars */
	convars?: Readonly<Record<string, string | number | boolean>>
	/**
	 * Optional absolute path to the dev-trigger file. Emitted as
	 * `set nextvm_dev_trigger "<path>"` so the runtime-server's dev
	 * bridge can find it regardless of FXServer's cwd. Required for
	 * end-to-end hot-reload in split server/server-data layouts.
	 */
	devTriggerPath?: string
}

/**
 * The `io` interface lets tests inject mocks for filesystem,
 * subprocess, and process.platform without touching the real disk.
 */
export interface RunnerIo {
	platform: NodeJS.Platform
	mkdirSync(path: string, opts: { recursive: true }): void
	existsSync(path: string): boolean
	readFileSync(path: string): string
	writeFileSync(path: string, contents: string): void
	rmSync(path: string, opts: { recursive: true; force: true }): void
	symlinkSync(target: string, path: string, type?: 'dir' | 'junction'): void
	cpSync(src: string, dest: string, opts: { recursive: true }): void
	spawn(
		command: string,
		args: readonly string[],
		opts: { cwd: string },
	): SpawnedProcess
	/** Check whether a process with the given PID is currently alive. */
	isProcessAlive(pid: number): boolean
}

/**
 * Minimal subprocess surface — a subset of node:child_process so the
 * real implementation and the test mock can both implement it.
 */
export interface SpawnedProcess {
	pid: number | undefined
	stdout: { on(event: 'data', cb: (chunk: Buffer) => void): void }
	stderr: { on(event: 'data', cb: (chunk: Buffer) => void): void }
	stdin: { write(data: string): boolean }
	on(event: 'exit', cb: (code: number | null) => void): void
	on(event: 'error', cb: (err: Error) => void): void
	kill(signal?: NodeJS.Signals): boolean
}

export interface RunnerOptions {
	/** Absolute path to the FXServer install root (containing FXServer.exe / FXServer / run.sh) */
	fxserverPath: string
	/**
	 * Absolute path to the FXServer data directory (containing `resources/`).
	 * Defaults to `fxserverPath` for the all-in-one layout. Set this when
	 * the binary lives in a separate folder from server-data (the standard
	 * cfx-server-data layout: `server/` for the binary, `server-data/` for
	 * resources + server.cfg).
	 */
	fxserverDataPath?: string
	/** Absolute path to the project root (where modules/* live) */
	projectRoot: string
	/** Modules to link + ensure */
	modules: readonly RunnerModule[]
	/** server.cfg parameters */
	serverCfg: Omit<ServerCfgInput, 'modules'>
	/** Logger callback for both runner-internal logs and FXServer stdout/stderr */
	onLog?: (line: string, source: 'runner' | 'fxserver') => void
	/** Optional callback fired when the FXServer process exits */
	onExit?: (code: number | null) => void
	/** IO adapter — defaults to the real fs/child_process when omitted */
	io?: RunnerIo
}

export type RunnerState = 'idle' | 'starting' | 'running' | 'stopping' | 'stopped'
