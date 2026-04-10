import { existsSync, mkdirSync, readFileSync, watch as fsWatch, type FSWatcher } from 'node:fs'
import { dirname } from 'node:path'

/**
 * Live ensure-restart bridge for `nextvm dev`.
 *   "Dev mode: hot-reload, NUI HMR, file watching … the framework can
 *    `ensure`-restart the affected resource so the new bundle is
 *    picked up without losing player state."
 * Wire protocol — paired with `writeDevTrigger()` in `@nextvm/build`:
 *   .nextvm/dev-trigger.json  →  { module, timestamp }
 * The build orchestrator calls `writeDevTrigger(module)` after a
 * successful per-module rebuild. The runtime watches that file via
 * `fs.watch`; on change it reads the JSON, debounces, and runs
 * `ExecuteCommand('ensure <module>')` inside the FXServer. State is
 * preserved automatically by the existing snapshot mechanism: the
 * stop hook fires before the resource shuts down, the bootstrap on
 * the way back up restores from the fresh snapshot.
 * The bridge is opt-in via `bootstrapServer({ devBridge: { ... } })`.
 * IO is fully injected so unit tests can drive it deterministically.
 */

export interface DevTrigger {
	module: string
	timestamp: number
}

export interface DevBridgeIo {
	exists(path: string): boolean
	read(path: string): string
	watch(path: string, handler: () => void): { close(): void }
	executeCommand(command: string): void
}

const realFsIo = (executeCommand: (cmd: string) => void): DevBridgeIo => ({
	exists: (path) => existsSync(path),
	read: (path) => readFileSync(path, 'utf-8'),
	watch: (path, handler) => {
		// Ensure the directory exists so fs.watch doesn't ENOENT before
		// the build orchestrator writes the first trigger file.
		const dir = dirname(path)
		if (dir && !existsSync(dir)) mkdirSync(dir, { recursive: true })
		// Watch the directory rather than the file itself — fs.watch on a
		// non-existent file throws on most platforms, and the file is
		// rewritten on every rebuild so inode-based watches drop fast.
		const watcher: FSWatcher = fsWatch(dir, (_event, filename) => {
			if (filename && path.endsWith(filename)) handler()
		})
		return { close: () => watcher.close() }
	},
	executeCommand,
})

export interface DevBridgeOptions {
	/** Path to the trigger file (default `.nextvm/dev-trigger.json`) */
	path?: string
	/** Debounce ms — coalesce duplicate fs.watch events (default 100) */
	debounceMs?: number
	/** Skip triggers older than this many ms — protects against stale files at startup (default 5_000) */
	freshAfterMs?: number
	/** IO override (test injection) */
	io?: DevBridgeIo
	/** Logger callback */
	log?: (msg: string, data?: Record<string, unknown>) => void
}

export interface DevBridgeHandle {
	stop(): void
}

const DEFAULT_PATH = '.nextvm/dev-trigger.json'

/**
 * Start the dev bridge. Returns a handle whose `stop()` closes the
 * filesystem watcher. Called from `bootstrapServer()` only when
 * `opts.devBridge` is set.
 */
export function startDevBridge(opts: DevBridgeOptions = {}): DevBridgeHandle {
	const io = opts.io ?? realFsIo((cmd) => {
		// Real ExecuteCommand is a FiveM global; tests inject their own io.
		const g = globalThis as Record<string, unknown>
		const exec = g.ExecuteCommand as ((c: string) => void) | undefined
		if (typeof exec === 'function') exec(cmd)
		else opts.log?.('ExecuteCommand global missing — dev bridge inert', { cmd })
	})
	// Path resolution priority:
	//   1. explicit opts.path
	//   2. GetConvar('nextvm_dev_trigger')  ← set by @nextvm/fxserver-runner
	//   3. relative DEFAULT_PATH (only works when FXServer cwd == projectRoot)
	let path = opts.path ?? DEFAULT_PATH
	if (!opts.path) {
		const g = globalThis as Record<string, unknown>
		const getConvar = g.GetConvar as
			| ((name: string, dflt: string) => string)
			| undefined
		if (typeof getConvar === 'function') {
			const fromConvar = getConvar('nextvm_dev_trigger', '')
			if (fromConvar && fromConvar.length > 0) path = fromConvar
		}
	}
	opts.log?.('Dev bridge watching trigger', { path })
	const debounceMs = opts.debounceMs ?? 100
	const freshAfterMs = opts.freshAfterMs ?? 5_000

	let pendingTimer: ReturnType<typeof setTimeout> | null = null
	let lastModule: string | null = null

	const handleChange = () => {
		if (!io.exists(path)) return
		let trigger: DevTrigger
		try {
			trigger = JSON.parse(io.read(path)) as DevTrigger
		} catch (err) {
			opts.log?.('Dev trigger unreadable', {
				error: err instanceof Error ? err.message : String(err),
			})
			return
		}
		if (typeof trigger.module !== 'string' || typeof trigger.timestamp !== 'number') {
			opts.log?.('Dev trigger malformed, ignoring', { trigger: trigger as unknown })
			return
		}
		const age = Date.now() - trigger.timestamp
		if (age > freshAfterMs) {
			opts.log?.('Dev trigger stale, ignoring', { module: trigger.module, ageMs: age })
			return
		}
		// Debounce duplicate triggers for the same module
		if (lastModule === trigger.module && pendingTimer) return
		lastModule = trigger.module
		if (pendingTimer) clearTimeout(pendingTimer)
		pendingTimer = setTimeout(() => {
			pendingTimer = null
			lastModule = null
			opts.log?.('Dev bridge: ensuring module', { module: trigger.module })
			io.executeCommand(`ensure ${trigger.module}`)
		}, debounceMs)
	}

	const watcher = io.watch(path, handleChange)

	// If a trigger already exists at startup (e.g. previous dev session
	// crashed mid-rebuild), drain it once.
	handleChange()

	return {
		stop() {
			if (pendingTimer) clearTimeout(pendingTimer)
			watcher.close()
		},
	}
}
