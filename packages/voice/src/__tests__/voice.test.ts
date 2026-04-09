import { describe, expect, it, vi } from 'vitest'
import { InMemoryVoiceAdapter } from '../adapter'
import { VoiceService } from '../service'

const buildSvc = () => {
	const adapter = new InMemoryVoiceAdapter()
	const svc = new VoiceService(adapter)
	return { adapter, svc }
}

describe('VoiceService.registerChannel', () => {
	it('rejects ids ≤ 0', () => {
		const { svc } = buildSvc()
		expect(() => svc.registerChannel({ id: 0, label: 'x' })).toThrow(/positive/)
	})
	it('rejects duplicates', () => {
		const { svc } = buildSvc()
		svc.registerChannel({ id: 1, label: 'a' })
		expect(() => svc.registerChannel({ id: 1, label: 'b' })).toThrow(/already/)
	})
	it('lists registered channels', () => {
		const { svc } = buildSvc()
		svc.registerChannel({ id: 1, label: 'a' })
		svc.registerChannel({ id: 2, label: 'b' })
		expect(svc.listChannels()).toHaveLength(2)
	})
})

describe('VoiceService.join / leave', () => {
	it('joins a channel and writes through the adapter', () => {
		const { adapter, svc } = buildSvc()
		svc.registerChannel({ id: 5, label: 'police' })
		svc.join(99, 5)
		expect(svc.channelOf(99)).toBe(5)
		expect(adapter.radio.get(99)).toBe(5)
	})
	it('leaves the previous channel before joining a new one', () => {
		const { adapter, svc } = buildSvc()
		svc.registerChannel({ id: 1, label: 'a' })
		svc.registerChannel({ id: 2, label: 'b' })
		svc.join(7, 1)
		svc.join(7, 2)
		expect(svc.channelOf(7)).toBe(2)
		expect(adapter.radio.get(7)).toBe(2)
	})
	it('rejects unregistered channels', () => {
		const { svc } = buildSvc()
		expect(() => svc.join(1, 99)).toThrow(/not registered/)
	})
	it('rejects when ACL denies', () => {
		const { svc } = buildSvc()
		svc.registerChannel({
			id: 1,
			label: 'leo',
			canJoin: (src) => src === 1,
		})
		expect(() => svc.join(2, 1)).toThrow(/not allowed/)
		expect(svc.join(1, 1).ok).toBe(true)
	})
	it('leave clears the channel', () => {
		const { adapter, svc } = buildSvc()
		svc.registerChannel({ id: 1, label: 'a' })
		svc.join(7, 1)
		svc.leave(7)
		expect(svc.channelOf(7)).toBeNull()
		expect(adapter.radio.has(7)).toBe(false)
	})
	it('membersOf returns sources in the channel', () => {
		const { svc } = buildSvc()
		svc.registerChannel({ id: 1, label: 'a' })
		svc.registerChannel({ id: 2, label: 'b' })
		svc.join(1, 1)
		svc.join(2, 1)
		svc.join(3, 2)
		expect(svc.membersOf(1).sort()).toEqual([1, 2])
		expect(svc.membersOf(2)).toEqual([3])
	})
})

describe('VoiceService.setProximity', () => {
	it('forwards to the adapter', () => {
		const { adapter, svc } = buildSvc()
		svc.setProximity(1, 'shout')
		expect(adapter.proximity.get(1)).toBe('shout')
	})
})

describe('VoiceService phone calls', () => {
	it('startCall creates a session for both parties', () => {
		const { adapter, svc } = buildSvc()
		const call = svc.startCall(1, 2)
		expect(call.id).toBe(1)
		expect(adapter.call.get(1)).toBe(call.id)
		expect(adapter.call.get(2)).toBe(call.id)
	})
	it('rejects calls to self', () => {
		const { svc } = buildSvc()
		expect(() => svc.startCall(1, 1)).toThrow(/yourself/)
	})
	it('rejects when one party is already in a call', () => {
		const { svc } = buildSvc()
		svc.startCall(1, 2)
		expect(() => svc.startCall(1, 3)).toThrow(/already/)
		expect(() => svc.startCall(3, 2)).toThrow(/already/)
	})
	it('endCall clears both endpoints', () => {
		const { adapter, svc } = buildSvc()
		svc.startCall(1, 2)
		svc.endCall(1)
		expect(svc.getCall(1)).toBeNull()
		expect(svc.getCall(2)).toBeNull()
		expect(adapter.call.has(1)).toBe(false)
		expect(adapter.call.has(2)).toBe(false)
	})
	it('endCall is a no-op when not in a call', () => {
		const { svc } = buildSvc()
		expect(() => svc.endCall(99)).not.toThrow()
	})
})

describe('VoiceService mute', () => {
	it('mute writes through the adapter', () => {
		const { adapter, svc } = buildSvc()
		svc.mute(1)
		expect(adapter.muted.get(1)).toBe(true)
	})
	it('unmute clears the flag', () => {
		const { adapter, svc } = buildSvc()
		svc.mute(1)
		svc.unmute(1)
		expect(adapter.muted.get(1)).toBe(false)
	})
	it('mute with durationMs auto-unmutes', () => {
		vi.useFakeTimers()
		const { adapter, svc } = buildSvc()
		svc.mute(1, { durationMs: 100 })
		expect(adapter.muted.get(1)).toBe(true)
		vi.advanceTimersByTime(150)
		expect(adapter.muted.get(1)).toBe(false)
		vi.useRealTimers()
	})
	it('re-muting cancels the previous timer', () => {
		vi.useFakeTimers()
		const { adapter, svc } = buildSvc()
		svc.mute(1, { durationMs: 100 })
		svc.mute(1, { durationMs: 500 })
		vi.advanceTimersByTime(200)
		expect(adapter.muted.get(1)).toBe(true)
		vi.advanceTimersByTime(400)
		expect(adapter.muted.get(1)).toBe(false)
		vi.useRealTimers()
	})
})

describe('VoiceService.dropSource', () => {
	it('cleans up channel + call + mute', () => {
		const { adapter, svc } = buildSvc()
		svc.registerChannel({ id: 1, label: 'a' })
		svc.join(1, 1)
		svc.startCall(1, 2)
		svc.mute(1)
		svc.dropSource(1)
		expect(svc.channelOf(1)).toBeNull()
		expect(svc.getCall(1)).toBeNull()
		expect(adapter.muted.get(1)).toBe(false)
	})
})
