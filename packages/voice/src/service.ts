import type { ProximityMode, VoiceAdapter } from './adapter'

/**
 * Definition of a radio channel managed by the voice service.
 *
 * Concept v2.3, Chapter 20:
 *   - Channels are registered server-side (server-authoritative)
 *   - Each channel has an optional ACL — `canJoin(source)` — so a
 *     module can gate access by job/permission/character without the
 *     voice service needing to know about jobs or permissions
 */
export interface RadioChannelDefinition {
	id: number
	label: string
	canJoin?: (source: number) => boolean
}

/** Active phone call between two players */
export interface PhoneCall {
	id: number
	caller: number
	target: number
	startedAt: number
}

/**
 * VoiceService — server-authoritative voice management.
 *
 * Wraps a `VoiceAdapter` (real or in-memory) and adds:
 *   - typed radio-channel registry with ACL
 *   - per-character proximity tracking
 *   - phone-call sessions with id correlation
 *   - mute with optional expiry
 *
 * GUARD-003: every state-changing call goes through the server.
 * GUARD-006: instance state, no globals.
 */
export class VoiceService {
	private channels = new Map<number, RadioChannelDefinition>()
	private memberOf = new Map<number, number>() // source → channel id
	private calls = new Map<number, PhoneCall>() // call id → call
	private callOf = new Map<number, number>() // source → call id
	private muteTimers = new Map<number, ReturnType<typeof setTimeout>>()
	private nextCallId = 1

	constructor(private readonly adapter: VoiceAdapter) {}

	// --- Radio channels ---

	registerChannel(def: RadioChannelDefinition): void {
		if (def.id <= 0) {
			throw new Error('Radio channel id must be a positive integer')
		}
		if (this.channels.has(def.id)) {
			throw new Error(`Radio channel ${def.id} is already registered`)
		}
		this.channels.set(def.id, def)
	}

	listChannels(): RadioChannelDefinition[] {
		return Array.from(this.channels.values())
	}

	join(source: number, channelId: number): { ok: true } {
		const channel = this.channels.get(channelId)
		if (!channel) {
			throw new Error(`Radio channel ${channelId} is not registered`)
		}
		if (channel.canJoin && !channel.canJoin(source)) {
			throw new Error(`Source ${source} is not allowed in channel ${channelId}`)
		}
		// Leave any previous channel first so memberships stay 1:1
		const previous = this.memberOf.get(source)
		if (previous !== undefined) {
			this.adapter.setRadioChannel(source, 0)
		}
		this.memberOf.set(source, channelId)
		this.adapter.setRadioChannel(source, channelId)
		return { ok: true }
	}

	leave(source: number): void {
		if (!this.memberOf.has(source)) return
		this.memberOf.delete(source)
		this.adapter.setRadioChannel(source, 0)
	}

	channelOf(source: number): number | null {
		return this.memberOf.get(source) ?? null
	}

	membersOf(channelId: number): number[] {
		const result: number[] = []
		for (const [src, ch] of this.memberOf) {
			if (ch === channelId) result.push(src)
		}
		return result
	}

	// --- Proximity ---

	setProximity(source: number, mode: ProximityMode): void {
		this.adapter.setProximity(source, mode)
	}

	// --- Phone calls ---

	startCall(caller: number, target: number): PhoneCall {
		if (caller === target) {
			throw new Error('Cannot start a call with yourself')
		}
		if (this.callOf.has(caller) || this.callOf.has(target)) {
			throw new Error('One of the parties is already in a call')
		}
		const id = this.nextCallId++
		const call: PhoneCall = { id, caller, target, startedAt: Date.now() }
		this.calls.set(id, call)
		this.callOf.set(caller, id)
		this.callOf.set(target, id)
		this.adapter.setCallChannel(caller, id)
		this.adapter.setCallChannel(target, id)
		return call
	}

	endCall(source: number): void {
		const id = this.callOf.get(source)
		if (id === undefined) return
		const call = this.calls.get(id)
		this.calls.delete(id)
		if (call) {
			this.callOf.delete(call.caller)
			this.callOf.delete(call.target)
			this.adapter.setCallChannel(call.caller, 0)
			this.adapter.setCallChannel(call.target, 0)
		}
	}

	getCall(source: number): PhoneCall | null {
		const id = this.callOf.get(source)
		return id !== undefined ? (this.calls.get(id) ?? null) : null
	}

	// --- Mute ---

	mute(source: number, opts?: { durationMs?: number }): void {
		this.adapter.setMuted(source, true)
		const existing = this.muteTimers.get(source)
		if (existing) clearTimeout(existing)
		if (opts?.durationMs && opts.durationMs > 0) {
			const timer = setTimeout(() => {
				this.unmute(source)
			}, opts.durationMs)
			this.muteTimers.set(source, timer)
		}
	}

	unmute(source: number): void {
		this.adapter.setMuted(source, false)
		const timer = this.muteTimers.get(source)
		if (timer) {
			clearTimeout(timer)
			this.muteTimers.delete(source)
		}
	}

	// --- Lifecycle ---

	/** Drop all state for a source — call from onPlayerDropped */
	dropSource(source: number): void {
		this.leave(source)
		this.endCall(source)
		this.unmute(source)
	}
}
