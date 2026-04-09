import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { startDevBridge, type DevBridgeIo, type DevTrigger } from '../dev-bridge'

/**
 * In-memory IO for the dev bridge tests. Lets the test fire a watch
 * event by calling `triggerWatch()` after writing into `files`.
 */
const buildIo = () => {
	const files = new Map<string, string>()
	const commands: string[] = []
	let watchHandler: (() => void) | null = null
	const io: DevBridgeIo = {
		exists: (p) => files.has(p),
		read: (p) => files.get(p) ?? '',
		watch: (_path, handler) => {
			watchHandler = handler
			return { close: () => undefined }
		},
		executeCommand: (cmd) => commands.push(cmd),
	}
	return {
		io,
		files,
		commands,
		triggerWatch: () => watchHandler?.(),
		set: (path: string, payload: DevTrigger) => {
			files.set(path, JSON.stringify(payload))
		},
	}
}

beforeEach(() => {
	vi.useFakeTimers()
})
afterEach(() => {
	vi.useRealTimers()
})

describe('startDevBridge', () => {
	it('runs ExecuteCommand("ensure <module>") on a fresh trigger', () => {
		const { io, commands, triggerWatch, set } = buildIo()
		startDevBridge({ io, path: 'snap.json', debounceMs: 10 })
		set('snap.json', { module: 'banking', timestamp: Date.now() })
		triggerWatch()
		vi.advanceTimersByTime(20)
		expect(commands).toEqual(['ensure banking'])
	})

	it('drains an existing trigger at startup', () => {
		const { io, commands, files } = buildIo()
		files.set('snap.json', JSON.stringify({ module: 'jobs', timestamp: Date.now() }))
		startDevBridge({ io, path: 'snap.json', debounceMs: 10 })
		vi.advanceTimersByTime(20)
		expect(commands).toEqual(['ensure jobs'])
	})

	it('debounces duplicate triggers for the same module', () => {
		const { io, commands, triggerWatch, set } = buildIo()
		startDevBridge({ io, path: 'snap.json', debounceMs: 50 })
		set('snap.json', { module: 'a', timestamp: Date.now() })
		triggerWatch()
		triggerWatch()
		triggerWatch()
		vi.advanceTimersByTime(100)
		expect(commands).toEqual(['ensure a'])
	})

	it('ignores stale triggers', () => {
		const { io, commands, triggerWatch, set } = buildIo()
		startDevBridge({ io, path: 'snap.json', debounceMs: 10, freshAfterMs: 1_000 })
		set('snap.json', { module: 'a', timestamp: Date.now() - 5_000 })
		triggerWatch()
		vi.advanceTimersByTime(50)
		expect(commands).toEqual([])
	})

	it('ignores malformed JSON', () => {
		const { io, commands, files, triggerWatch } = buildIo()
		startDevBridge({ io, path: 'snap.json', debounceMs: 10 })
		files.set('snap.json', '{not: json')
		triggerWatch()
		vi.advanceTimersByTime(50)
		expect(commands).toEqual([])
	})

	it('ignores triggers without a module field', () => {
		const { io, commands, files, triggerWatch } = buildIo()
		startDevBridge({ io, path: 'snap.json', debounceMs: 10 })
		files.set('snap.json', JSON.stringify({ timestamp: Date.now() }))
		triggerWatch()
		vi.advanceTimersByTime(50)
		expect(commands).toEqual([])
	})

	it('ignores when no file exists', () => {
		const { io, commands, triggerWatch } = buildIo()
		startDevBridge({ io, path: 'snap.json', debounceMs: 10 })
		triggerWatch()
		vi.advanceTimersByTime(50)
		expect(commands).toEqual([])
	})

	it('handles different modules in sequence', () => {
		const { io, commands, triggerWatch, set } = buildIo()
		startDevBridge({ io, path: 'snap.json', debounceMs: 10 })
		set('snap.json', { module: 'a', timestamp: Date.now() })
		triggerWatch()
		vi.advanceTimersByTime(20)
		set('snap.json', { module: 'b', timestamp: Date.now() })
		triggerWatch()
		vi.advanceTimersByTime(20)
		expect(commands).toEqual(['ensure a', 'ensure b'])
	})

	it('stop() closes the watcher and clears pending timers', () => {
		const { io, commands, triggerWatch, set } = buildIo()
		const handle = startDevBridge({ io, path: 'snap.json', debounceMs: 100 })
		set('snap.json', { module: 'a', timestamp: Date.now() })
		triggerWatch()
		handle.stop()
		vi.advanceTimersByTime(200)
		expect(commands).toEqual([])
	})
})
