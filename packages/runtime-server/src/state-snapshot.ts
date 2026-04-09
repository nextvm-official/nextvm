import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import type { ModuleLoader } from '@nextvm/core'

/**
 * State snapshot writer/reader for hot-reload across `ensure` restarts.
 *   "Dev mode: hot-reload, NUI HMR, file watching. State preservation
 *    across restarts so iteration doesn't lose player state."
 * Strategy: filesystem snapshot.
 *   - On `runtime.stop()` (driven by `onResourceStop`), the runtime
 *     walks every state store the loader knows about, calls
 *     `serialize()`, and writes one JSON file with a timestamp.
 *   - On `bootstrapServer()`, the runtime checks for that file. If it
 *     exists *and* is younger than `staleAfterMs` (default 60s — long
 *     enough for an `ensure` restart, short enough that we don't
 *     restore stale state on a real cold boot), it deserializes every
 *     matching store and deletes the file.
 * Stores not present in the snapshot are left alone (new modules); keys
 * present in the snapshot but no longer registered are dropped silently
 * (removed modules). The snapshot format is forward/backward compatible
 * by construction.
 * The IO surface is injected so the whole feature is unit-testable in
 * plain Node without touching the real filesystem.
 */

export interface SnapshotEnvelope {
	version: 1
	timestamp: number
	stores: Record<string, Record<string, Record<string, unknown>>>
}

export interface SnapshotIo {
	exists(path: string): boolean
	read(path: string): string
	write(path: string, contents: string): void
	remove(path: string): void
}

export const defaultSnapshotIo: SnapshotIo = {
	exists: (path) => existsSync(path),
	read: (path) => readFileSync(path, 'utf-8'),
	write: (path, contents) => {
		const dir = dirname(path)
		if (dir && !existsSync(dir)) mkdirSync(dir, { recursive: true })
		writeFileSync(path, contents, 'utf-8')
	},
	remove: (path) => {
		if (existsSync(path)) rmSync(path)
	},
}

export interface SnapshotOptions {
	/** Path the snapshot is written to (default `.nextvm/state-snapshot.json`) */
	path?: string
	/** Reject snapshots older than this many ms (default 60_000) */
	staleAfterMs?: number
	/** IO override (test injection) */
	io?: SnapshotIo
	/** Logger callback */
	log?: (msg: string, data?: Record<string, unknown>) => void
}

const DEFAULT_PATH = '.nextvm/state-snapshot.json'
const DEFAULT_STALE_MS = 60_000

/**
 * Write a snapshot of every registered state store to disk.
 * Called from `runtime.stop()`.
 */
export function writeStateSnapshot(loader: ModuleLoader, opts: SnapshotOptions = {}): void {
	const io = opts.io ?? defaultSnapshotIo
	const path = opts.path ?? DEFAULT_PATH
	const stores = loader.getStateStores()
	if (stores.size === 0) return

	const envelope: SnapshotEnvelope = {
		version: 1,
		timestamp: Date.now(),
		stores: {},
	}
	for (const [key, store] of stores) {
		envelope.stores[key] = store.serialize()
	}
	io.write(path, JSON.stringify(envelope))
	opts.log?.('State snapshot written', { path, stores: stores.size })
}

/**
 * Restore a previously written snapshot, if one exists and is fresh.
 * Called from `bootstrapServer()` before any FiveM events fire.
 * Returns the number of stores that were restored, or `0` if no fresh
 * snapshot was found.
 */
export function restoreStateSnapshot(
	loader: ModuleLoader,
	opts: SnapshotOptions = {},
): number {
	const io = opts.io ?? defaultSnapshotIo
	const path = opts.path ?? DEFAULT_PATH
	const staleAfterMs = opts.staleAfterMs ?? DEFAULT_STALE_MS

	if (!io.exists(path)) return 0

	let envelope: SnapshotEnvelope
	try {
		envelope = JSON.parse(io.read(path)) as SnapshotEnvelope
	} catch {
		opts.log?.('State snapshot is unreadable, ignoring', { path })
		io.remove(path)
		return 0
	}

	if (envelope.version !== 1) {
		opts.log?.('State snapshot version mismatch, ignoring', {
			path,
			version: envelope.version,
		})
		io.remove(path)
		return 0
	}

	const age = Date.now() - envelope.timestamp
	if (age > staleAfterMs) {
		opts.log?.('State snapshot is stale, ignoring', { path, ageMs: age })
		io.remove(path)
		return 0
	}

	const stores = loader.getStateStores()
	let restored = 0
	for (const [key, store] of stores) {
		const data = envelope.stores[key]
		if (!data) continue
		try {
			store.deserialize(data)
			restored++
		} catch (err) {
			opts.log?.('Failed to deserialize store', {
				key,
				error: err instanceof Error ? err.message : String(err),
			})
		}
	}

	io.remove(path)
	opts.log?.('State snapshot restored', { path, restored, ageMs: age })
	return restored
}
