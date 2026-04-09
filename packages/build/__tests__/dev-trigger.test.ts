import { describe, expect, it } from 'vitest'
import { writeDevTrigger, type DevTriggerPayload } from '../src/dev-trigger'

const buildIo = () => {
	const writes: Array<[string, string]> = []
	return {
		writes,
		io: { write: (path: string, contents: string) => writes.push([path, contents]) },
	}
}

describe('writeDevTrigger', () => {
	it('writes JSON with module + timestamp at the default path', () => {
		const { io, writes } = buildIo()
		const before = Date.now()
		const path = writeDevTrigger('banking', { rootDir: '/srv/x', io })
		const after = Date.now()
		expect(writes).toHaveLength(1)
		expect(path).toMatch(/dev-trigger\.json$/)
		const payload = JSON.parse(writes[0][1]) as DevTriggerPayload
		expect(payload.module).toBe('banking')
		expect(payload.timestamp).toBeGreaterThanOrEqual(before)
		expect(payload.timestamp).toBeLessThanOrEqual(after)
	})

	it('respects custom relPath', () => {
		const { io, writes } = buildIo()
		writeDevTrigger('housing', {
			rootDir: '/srv/x',
			relPath: 'tmp/trigger.json',
			io,
		})
		expect(writes[0][0]).toMatch(/tmp[\\/]trigger\.json$/)
	})
})
