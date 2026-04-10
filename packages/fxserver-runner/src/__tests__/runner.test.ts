import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { FxserverRunner } from '../runner'
import type { RunnerIo, SpawnedProcess } from '../types'

/**
 * Mock SpawnedProcess that captures listener registrations and lets
 * the test fire 'exit' / 'data' events on demand.
 */
function buildMockProcess(): SpawnedProcess & {
	emitExit(code: number | null): void
	emitStdout(data: string): void
	killCalls: NodeJS.Signals[]
} {
	const exitListeners: ((code: number | null) => void)[] = []
	const stdoutListeners: ((chunk: Buffer) => void)[] = []
	const killCalls: NodeJS.Signals[] = []

	return {
		pid: 12345,
		stdout: {
			on: (event, cb) => {
				if (event === 'data') stdoutListeners.push(cb)
			},
		},
		stderr: { on: () => undefined },
		stdin: { write: vi.fn(() => true) },
		on: (event, cb) => {
			if (event === 'exit') exitListeners.push(cb as (code: number | null) => void)
		},
		kill: (signal) => {
			killCalls.push((signal ?? 'SIGTERM') as NodeJS.Signals)
			return true
		},
		killCalls,
		emitExit: (code) => {
			for (const l of exitListeners) l(code)
		},
		emitStdout: (data) => {
			const chunk = Buffer.from(`${data}\n`)
			for (const l of stdoutListeners) l(chunk)
		},
	}
}

function buildMockIo(opts: {
	platform?: NodeJS.Platform
	existingPaths?: string[]
	mockProcess?: ReturnType<typeof buildMockProcess>
}): RunnerIo & { writes: Map<string, string>; mockProcess: ReturnType<typeof buildMockProcess> } {
	const files = new Set<string>(opts.existingPaths ?? [])
	const writes = new Map<string, string>()
	const mockProcess = opts.mockProcess ?? buildMockProcess()

	return {
		platform: opts.platform ?? 'linux',
		writes,
		mockProcess,
		mkdirSync: vi.fn((path) => {
			files.add(path)
		}),
		existsSync: vi.fn((path) => files.has(path)),
		readFileSync: vi.fn((path) => writes.get(path) ?? ''),
		writeFileSync: vi.fn((path, contents) => {
			writes.set(path, contents)
			files.add(path)
		}),
		rmSync: vi.fn((path) => {
			files.delete(path)
			writes.delete(path)
		}),
		symlinkSync: vi.fn((_, path) => {
			files.add(path)
		}),
		cpSync: vi.fn((_, dest) => {
			files.add(dest)
		}),
		spawn: vi.fn(() => mockProcess),
		isProcessAlive: vi.fn(() => false),
	}
}

const baseFxserverPath = '/srv/fivem'
const baseModules = [
	{ name: 'banking', path: '/proj/modules/banking' },
	{ name: 'jobs', path: '/proj/modules/jobs' },
]

const baseServerCfg = {
	hostname: 'Test',
	maxClients: 32,
	endpoint: '0.0.0.0:30120',
}

const buildRunningSetup = () => {
	const io = buildMockIo({
		existingPaths: [
			join(baseFxserverPath, 'resources'),
			join(baseFxserverPath, 'FXServer'), // resolveFxserverBinary will find this on linux
		],
	})
	const logs: { line: string; source: string }[] = []
	const runner = new FxserverRunner({
		fxserverPath: baseFxserverPath,
		projectRoot: '/proj',
		modules: baseModules,
		serverCfg: baseServerCfg,
		onLog: (line, source) => logs.push({ line, source }),
		io,
	})
	return { runner, io, logs }
}

describe('FxserverRunner', () => {
	it('starts in idle state', () => {
		const { runner } = buildRunningSetup()
		expect(runner.getState()).toBe('idle')
		expect(runner.getPid()).toBeNull()
	})

	it('start() transitions through starting → running', async () => {
		const { runner } = buildRunningSetup()
		await runner.start()
		expect(runner.getState()).toBe('running')
		expect(runner.getPid()).toBe(12345)
	})

	it('start() generates server.cfg.nextvm', async () => {
		const { runner, io } = buildRunningSetup()
		await runner.start()
		const cfg = io.writes.get(join(baseFxserverPath, 'server.cfg.nextvm'))
		expect(cfg).toBeDefined()
		expect(cfg).toContain('ensure banking')
		expect(cfg).toContain('ensure jobs')
		expect(cfg).toContain('sv_hostname "Test"')
	})

	it('start() spawns FXServer with +exec arg', async () => {
		const { runner, io } = buildRunningSetup()
		await runner.start()
		expect(io.spawn).toHaveBeenCalledWith(
			expect.stringContaining('FXServer'),
			['+exec', 'server.cfg.nextvm'],
			{ cwd: baseFxserverPath },
		)
	})

	it('start() throws if called twice on the same instance', async () => {
		const { runner } = buildRunningSetup()
		await runner.start()
		await expect(runner.start()).rejects.toThrow(/can only be started once/)
	})

	it('start() rolls back link state if subprocess spawn fails', async () => {
		const io = buildMockIo({
			existingPaths: [
				join(baseFxserverPath, 'resources'),
				join(baseFxserverPath, 'FXServer'),
			],
		})
		io.spawn = vi.fn(() => {
			throw new Error('ENOENT')
		})
		const runner = new FxserverRunner({
			fxserverPath: baseFxserverPath,
			projectRoot: '/proj',
			modules: baseModules,
			serverCfg: baseServerCfg,
			io,
		})
		await expect(runner.start()).rejects.toThrow(/ENOENT/)
		expect(runner.getState()).toBe('stopped')
	})

	it('stop() transitions running → stopping → stopped', async () => {
		const { runner, io } = buildRunningSetup()
		await runner.start()
		const stopPromise = runner.stop()
		expect(runner.getState()).toBe('stopping')
		// Process emits exit so stop() resolves
		io.mockProcess.emitExit(0)
		await stopPromise
		expect(runner.getState()).toBe('stopped')
	})

	it('stop() sends SIGTERM to the subprocess', async () => {
		const { runner, io } = buildRunningSetup()
		await runner.start()
		const stopPromise = runner.stop()
		io.mockProcess.emitExit(0)
		await stopPromise
		expect(io.mockProcess.killCalls).toContain('SIGTERM')
	})

	it('stop() force-kills with SIGKILL after grace period', async () => {
		vi.useFakeTimers()
		const { runner, io } = buildRunningSetup()
		await runner.start()
		const stopPromise = runner.stop(100)
		// Don't emit exit — let the grace period elapse
		await vi.advanceTimersByTimeAsync(150)
		await stopPromise
		expect(io.mockProcess.killCalls).toContain('SIGKILL')
		vi.useRealTimers()
	})

	it('stop() is a no-op when already stopped', async () => {
		const { runner } = buildRunningSetup()
		await runner.stop()
		expect(runner.getState()).toBe('stopped')
		// Second call should not throw
		await runner.stop()
		expect(runner.getState()).toBe('stopped')
	})

	it('ensure() throws when not running', () => {
		const { runner } = buildRunningSetup()
		expect(() => runner.ensure('banking')).toThrow(/must be running/)
	})

	it('ensure() sends the ensure command via stdin', async () => {
		const { runner } = buildRunningSetup()
		await runner.start()
		runner.ensure('banking')
		expect(runner['process']!.stdin.write).toHaveBeenCalledWith('ensure banking\n')
	})

	it('handles unexpected FXServer exit by transitioning to stopped', async () => {
		const { runner, io, logs } = buildRunningSetup()
		await runner.start()
		expect(runner.getState()).toBe('running')

		io.mockProcess.emitExit(1)
		expect(runner.getState()).toBe('stopped')
		expect(logs.some((l) => l.line.includes('exited unexpectedly'))).toBe(true)
	})

	it('writes a lockfile with the spawned PID on start()', async () => {
		const { runner, io } = buildRunningSetup()
		await runner.start()
		const lock = io.writes.get(join(baseFxserverPath, '.nextvm.lock'))
		expect(lock).toBe('12345')
	})

	it('removes the lockfile on stop()', async () => {
		const { runner, io } = buildRunningSetup()
		await runner.start()
		const stopPromise = runner.stop()
		io.mockProcess.emitExit(0)
		await stopPromise
		expect(io.existsSync(join(baseFxserverPath, '.nextvm.lock'))).toBe(false)
	})

	it('refuses to start if a lockfile with a live PID exists', async () => {
		const io = buildMockIo({
			existingPaths: [
				join(baseFxserverPath, 'resources'),
				join(baseFxserverPath, 'FXServer'),
				join(baseFxserverPath, '.nextvm.lock'),
			],
		})
		// Pre-populate the lockfile contents + mark the PID as alive
		io.writes.set(join(baseFxserverPath, '.nextvm.lock'), '99999')
		io.isProcessAlive = vi.fn((pid) => pid === 99999)
		const runner = new FxserverRunner({
			fxserverPath: baseFxserverPath,
			projectRoot: '/proj',
			modules: baseModules,
			serverCfg: baseServerCfg,
			io,
		})
		await expect(runner.start()).rejects.toThrow(/Another NextVM runner/)
	})

	it('reclaims a stale lockfile when the recorded PID is dead', async () => {
		const io = buildMockIo({
			existingPaths: [
				join(baseFxserverPath, 'resources'),
				join(baseFxserverPath, 'FXServer'),
				join(baseFxserverPath, '.nextvm.lock'),
			],
		})
		io.writes.set(join(baseFxserverPath, '.nextvm.lock'), '88888')
		io.isProcessAlive = vi.fn(() => false)
		const runner = new FxserverRunner({
			fxserverPath: baseFxserverPath,
			projectRoot: '/proj',
			modules: baseModules,
			serverCfg: baseServerCfg,
			io,
		})
		await runner.start()
		expect(runner.getState()).toBe('running')
		// New lock with our own PID
		expect(io.writes.get(join(baseFxserverPath, '.nextvm.lock'))).toBe('12345')
	})

	it('forwards FXServer stdout lines to onLog with source=fxserver', async () => {
		const { runner, io, logs } = buildRunningSetup()
		await runner.start()
		io.mockProcess.emitStdout('hello from fxserver')
		const fxLogs = logs.filter((l) => l.source === 'fxserver')
		expect(fxLogs.some((l) => l.line === 'hello from fxserver')).toBe(true)
	})
})
