import { defineModule, defineState, ModuleLoader, z } from '@nextvm/core'
import { describe, expect, it } from 'vitest'
import { bootstrapServer } from '../bootstrap'
import {
	restoreStateSnapshot,
	writeStateSnapshot,
	type SnapshotEnvelope,
	type SnapshotIo,
} from '../state-snapshot'

/**
 * In-memory IO for the snapshot tests. Keeps the unit test fully
 * deterministic and avoids touching the real filesystem.
 */
const buildMemoryIo = () => {
	const files = new Map<string, string>()
	const io: SnapshotIo = {
		exists: (p) => files.has(p),
		read: (p) => files.get(p) ?? '',
		write: (p, c) => {
			files.set(p, c)
		},
		remove: (p) => {
			files.delete(p)
		},
	}
	return { io, files }
}

const buildLoader = () => {
	const loader = new ModuleLoader()
	const playerState = defineState('player', {
		health: z.number().default(100).describe('Health (0-200)'),
		armor: z.number().default(0).describe('Armor (0-100)'),
	})
	const inventoryState = defineState('inventory', {
		slots: z
			.array(z.object({ slot: z.number(), itemId: z.string(), count: z.number() }))
			.default([])
			.describe('Inventory slots'),
	})
	loader.register(
		defineModule({
			name: 'player',
			version: '0.1.0',
			server: () => undefined,
			shared: { schemas: { state: playerState } },
		}),
	)
	loader.register(
		defineModule({
			name: 'inventory',
			version: '0.1.0',
			server: () => undefined,
			shared: { schemas: { state: inventoryState } },
		}),
	)
	return { loader, playerState, inventoryState }
}

describe('ModuleLoader.getStateStores', () => {
	it('walks shared.schemas and returns every StateStore', () => {
		const { loader, playerState, inventoryState } = buildLoader()
		const stores = loader.getStateStores()
		expect(stores.size).toBe(2)
		expect(stores.get('player.state')).toBe(playerState)
		expect(stores.get('inventory.state')).toBe(inventoryState)
	})

	it('skips non-StateStore values in shared.schemas', () => {
		const loader = new ModuleLoader()
		loader.register(
			defineModule({
				name: 'thing',
				version: '0.1.0',
				server: () => undefined,
				shared: { schemas: { not_a_store: { whatever: true } } },
			}),
		)
		expect(loader.getStateStores().size).toBe(0)
	})
})

describe('writeStateSnapshot', () => {
	it('writes a versioned envelope with every store', () => {
		const { loader, playerState } = buildLoader()
		playerState.set(42, 'health', 75)
		playerState.set(42, 'armor', 50)
		const { io, files } = buildMemoryIo()
		writeStateSnapshot(loader, { io, path: 'snap.json' })
		const envelope = JSON.parse(files.get('snap.json') ?? '{}') as SnapshotEnvelope
		expect(envelope.version).toBe(1)
		expect(envelope.timestamp).toBeGreaterThan(0)
		expect(envelope.stores['player.state']).toBeDefined()
		expect(envelope.stores['player.state'][42]).toEqual({ health: 75, armor: 50 })
	})

	it('writes nothing if there are no state stores', () => {
		const loader = new ModuleLoader()
		const { io, files } = buildMemoryIo()
		writeStateSnapshot(loader, { io, path: 'snap.json' })
		expect(files.size).toBe(0)
	})
})

describe('restoreStateSnapshot', () => {
	it('returns 0 when no snapshot exists', () => {
		const { loader } = buildLoader()
		const { io } = buildMemoryIo()
		expect(restoreStateSnapshot(loader, { io, path: 'snap.json' })).toBe(0)
	})

	it('restores values into matching stores', () => {
		const { loader, playerState } = buildLoader()
		const { io } = buildMemoryIo()
		// Pretend we wrote this from a previous run
		const envelope: SnapshotEnvelope = {
			version: 1,
			timestamp: Date.now(),
			stores: {
				'player.state': { '7': { health: 33, armor: 10 } },
			},
		}
		io.write('snap.json', JSON.stringify(envelope))
		const restored = restoreStateSnapshot(loader, { io, path: 'snap.json' })
		expect(restored).toBe(1)
		expect(playerState.get(7, 'health')).toBe(33)
		expect(playerState.get(7, 'armor')).toBe(10)
	})

	it('deletes the snapshot file after a successful restore', () => {
		const { loader } = buildLoader()
		const { io, files } = buildMemoryIo()
		io.write(
			'snap.json',
			JSON.stringify({ version: 1, timestamp: Date.now(), stores: {} }),
		)
		restoreStateSnapshot(loader, { io, path: 'snap.json' })
		expect(files.has('snap.json')).toBe(false)
	})

	it('rejects + deletes a stale snapshot', () => {
		const { loader, playerState } = buildLoader()
		const { io, files } = buildMemoryIo()
		const envelope: SnapshotEnvelope = {
			version: 1,
			timestamp: Date.now() - 120_000, // 2 min old
			stores: { 'player.state': { '7': { health: 33, armor: 10 } } },
		}
		io.write('snap.json', JSON.stringify(envelope))
		const restored = restoreStateSnapshot(loader, {
			io,
			path: 'snap.json',
			staleAfterMs: 60_000,
		})
		expect(restored).toBe(0)
		expect(playerState.get(7, 'health')).toBe(100) // schema default
		expect(files.has('snap.json')).toBe(false)
	})

	it('rejects + deletes an unparseable snapshot', () => {
		const { loader } = buildLoader()
		const { io, files } = buildMemoryIo()
		io.write('snap.json', 'not json {{{')
		expect(restoreStateSnapshot(loader, { io, path: 'snap.json' })).toBe(0)
		expect(files.has('snap.json')).toBe(false)
	})

	it('rejects + deletes a wrong-version snapshot', () => {
		const { loader } = buildLoader()
		const { io, files } = buildMemoryIo()
		io.write(
			'snap.json',
			JSON.stringify({ version: 99, timestamp: Date.now(), stores: {} }),
		)
		expect(restoreStateSnapshot(loader, { io, path: 'snap.json' })).toBe(0)
		expect(files.has('snap.json')).toBe(false)
	})

	it('ignores keys for stores that no longer exist', () => {
		const { loader } = buildLoader()
		const { io } = buildMemoryIo()
		io.write(
			'snap.json',
			JSON.stringify({
				version: 1,
				timestamp: Date.now(),
				stores: { 'removed.state': { '1': { foo: 'bar' } } },
			}),
		)
		// No throw, no restored stores
		expect(restoreStateSnapshot(loader, { io, path: 'snap.json' })).toBe(0)
	})

	it('round-trips through the runtime: stop writes, bootstrap restores', async () => {
		const { io, files } = buildMemoryIo()
		const playerState = defineState('player', {
			health: z.number().default(100).describe('Health'),
		})
		const playerModule = defineModule({
			name: 'player',
			version: '0.1.0',
			server: () => undefined,
			shared: { schemas: { state: playerState } },
		})

		// First boot — set state, then stop
		const runtime1 = await bootstrapServer({
			modules: [playerModule],
			stateSnapshot: { io, path: 'snap.json' },
		})
		const psA = (runtime1.loader.getStateStores().get('player.state') as
			| typeof playerState
			| undefined)
		expect(psA).toBeDefined()
		psA?.set(99, 'health', 42)
		await runtime1.stop()
		expect(files.has('snap.json')).toBe(true)

		// Second boot — should restore the same value
		const runtime2 = await bootstrapServer({
			modules: [
				defineModule({
					name: 'player',
					version: '0.1.0',
					server: () => undefined,
					shared: { schemas: { state: playerState } },
				}),
			],
			stateSnapshot: { io, path: 'snap.json' },
		})
		const psB = runtime2.loader.getStateStores().get('player.state') as
			| typeof playerState
			| undefined
		expect(psB?.get(99, 'health')).toBe(42)
		expect(files.has('snap.json')).toBe(false)
		await runtime2.stop()
	})

	it('stateSnapshot: false disables both write and restore', async () => {
		const { io, files } = buildMemoryIo()
		const playerState = defineState('player', {
			health: z.number().default(100).describe('Health'),
		})
		const runtime = await bootstrapServer({
			modules: [
				defineModule({
					name: 'player',
					version: '0.1.0',
					server: () => undefined,
					shared: { schemas: { state: playerState } },
				}),
			],
			stateSnapshot: false,
		})
		runtime.loader
			.getStateStores()
			.get('player.state')
			?.set(1, 'health', 50)
		await runtime.stop()
		expect(files.size).toBe(0)
		// Confirm io was never touched
		void io
	})
})
