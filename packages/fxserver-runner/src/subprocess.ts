import { join } from 'node:path'
import type { RunnerIo, SpawnedProcess } from './types'

/**
 * Resolve the FXServer executable path for the current platform.
 *
 * On Windows the binary is `FXServer.exe`. On Linux the user typically
 * has either `FXServer` (the binary) or `run.sh` (the cfx-server-data
 * wrapper). We prefer `run.sh` on Linux because it does the right
 * thing with cwd handling.
 */
export function resolveFxserverBinary(
	fxserverPath: string,
	platform: NodeJS.Platform,
	exists: (path: string) => boolean,
): string {
	const candidates =
		platform === 'win32'
			? [join(fxserverPath, 'FXServer.exe'), join(fxserverPath, 'run.cmd')]
			: [join(fxserverPath, 'run.sh'), join(fxserverPath, 'FXServer')]

	for (const candidate of candidates) {
		if (exists(candidate)) return candidate
	}

	throw new Error(
		`Could not find an FXServer executable in ${fxserverPath}\n` +
			`Checked: ${candidates.join(', ')}\n` +
			`Is the fxserverPath correct? It should point at the directory ` +
			`containing FXServer.exe (Windows) or run.sh (Linux).`,
	)
}

/**
 * Spawn the FXServer subprocess and wire its stdout/stderr to a
 * line-based callback.
 *
 * The caller (FxserverRunner) handles state transitions and lifecycle —
 * this function just does the spawn and stream wiring.
 */
export interface SpawnFxserverOptions {
	binary: string
	cwd: string
	configFile: string
	io: RunnerIo
	onLog: (line: string) => void
	onExit: (code: number | null) => void
	onError: (err: Error) => void
}

export function spawnFxserver(opts: SpawnFxserverOptions): SpawnedProcess {
	// FXServer accepts `+exec <cfg>` to load a config file at startup.
	// We pass the explicit cfg path so the user's hand-managed
	// `server.cfg` is left alone.
	const args = ['+exec', opts.configFile]

	const child = opts.io.spawn(opts.binary, args, { cwd: opts.cwd })

	const lineBuffer = createLineBuffer(opts.onLog)
	child.stdout.on('data', (chunk) => lineBuffer.push(chunk))
	child.stderr.on('data', (chunk) => lineBuffer.push(chunk))

	child.on('exit', (code) => {
		lineBuffer.flush()
		opts.onExit(code)
	})

	child.on('error', (err) => {
		opts.onError(err)
	})

	return child
}

/**
 * Buffer stdout/stderr chunks and emit one log line at a time.
 *
 * Subprocess streams arrive in arbitrary chunks — sometimes mid-line,
 * sometimes multiple lines at once. The runner wants line-oriented
 * output for nice prefix coloring, so we buffer until we see a newline.
 */
function createLineBuffer(emit: (line: string) => void): {
	push(chunk: Buffer): void
	flush(): void
} {
	let pending = ''
	return {
		push(chunk) {
			pending += chunk.toString('utf-8')
			let idx = pending.indexOf('\n')
			while (idx !== -1) {
				const line = pending.slice(0, idx).replace(/\r$/, '')
				if (line.length > 0) emit(line)
				pending = pending.slice(idx + 1)
				idx = pending.indexOf('\n')
			}
		},
		flush() {
			if (pending.length > 0) {
				const line = pending.replace(/\r$/, '')
				if (line.length > 0) emit(line)
				pending = ''
			}
		},
	}
}
