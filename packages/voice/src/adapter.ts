/**
 * VoiceAdapter — the narrow surface VoiceService needs from the
 * underlying voice runtime (pma-voice via @nextvm/natives in production,
 * an in-memory mock in tests).
 * unaware of pma-voice specifics so it can be unit-tested without
 * the FXServer".
 */
export type ProximityMode = 'whisper' | 'normal' | 'shout'

export interface VoiceAdapter {
	setProximity(source: number, mode: ProximityMode): void
	setRadioChannel(source: number, channel: number): void
	setCallChannel(source: number, channel: number): void
	setMuted(source: number, muted: boolean): void
}

/**
 * In-memory adapter — used by tests and any context outside the FiveM
 * server runtime. Records every call so test assertions can target the
 * resulting state directly.
 */
export class InMemoryVoiceAdapter implements VoiceAdapter {
	readonly proximity = new Map<number, ProximityMode>()
	readonly radio = new Map<number, number>()
	readonly call = new Map<number, number>()
	readonly muted = new Map<number, boolean>()

	setProximity(source: number, mode: ProximityMode): void {
		this.proximity.set(source, mode)
	}

	setRadioChannel(source: number, channel: number): void {
		if (channel === 0) this.radio.delete(source)
		else this.radio.set(source, channel)
	}

	setCallChannel(source: number, channel: number): void {
		if (channel === 0) this.call.delete(source)
		else this.call.set(source, channel)
	}

	setMuted(source: number, muted: boolean): void {
		this.muted.set(source, muted)
	}
}
