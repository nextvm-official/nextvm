import { execFileSync, spawn } from 'node:child_process'
import {
	cpSync,
	existsSync,
	mkdirSync,
	readFileSync,
	rmSync,
	symlinkSync,
	writeFileSync,
} from 'node:fs'
import { resolve } from 'node:path'
import { platform as nodePlatform } from 'node:process'
import type { RunnerIo, SpawnedProcess } from './types'

/**
 * Real-world `RunnerIo` implementation backed by node:fs and
 * node:child_process. Tests inject their own mock instead.
 */
export const defaultIo: RunnerIo = {
	platform: nodePlatform,
	mkdirSync: (path, opts) => mkdirSync(path, opts),
	existsSync: (path) => existsSync(path),
	readFileSync: (path) => readFileSync(path, 'utf-8'),
	writeFileSync: (path, contents) => writeFileSync(path, contents, 'utf-8'),
	rmSync: (path, opts) => rmSync(path, opts),
	symlinkSync: (target, path, type) => symlinkSync(target, path, type),
	cpSync: (src, dest, opts) => cpSync(src, dest, opts),
	isProcessAlive: (pid) => {
		// `process.kill(pid, 0)` checks for existence without sending
		// a signal. Throws if the process doesn't exist.
		try {
			process.kill(pid, 0)
			return true
		} catch {
			return false
		}
	},
	spawn: (command, args, opts): SpawnedProcess => {
		// resolve() normalizes relative paths (.fxserver/artifacts/FXServer.exe)
		// to absolute — child_process.spawn can't find binaries via relative paths.
		const child = spawn(resolve(command), [...args], {
			cwd: resolve(opts.cwd),
			stdio: ['pipe', 'pipe', 'pipe'],
		})
		return {
			pid: child.pid,
			stdout: { on: (event, cb) => child.stdout?.on(event, cb) },
			stderr: { on: (event, cb) => child.stderr?.on(event, cb) },
			stdin: { write: (data) => child.stdin?.write(data) ?? false },
			on: (event, cb) => child.on(event, cb as never),
			kill: (_signal) => {
				// Windows: FXServer.exe spawns a child server process and
				// neither responds to WM_CLOSE (it's a pure console app).
				// We must use `taskkill /T /F` to walk the tree and force
				// terminate everything. SIGTERM-vs-SIGKILL has no meaning
				// here — there's no graceful shutdown path short of
				// piping "quit\n" into stdin, which we don't wire up.
				if (nodePlatform === 'win32' && child.pid !== undefined) {
					try {
						execFileSync(
							'taskkill',
							['/PID', String(child.pid), '/T', '/F'],
							{ stdio: 'ignore' },
						)
						return true
					} catch {
						// Process may already be gone — fall through to
						// the standard kill as a last resort.
					}
				}
				return child.kill(_signal)
			},
		}
	},
}
