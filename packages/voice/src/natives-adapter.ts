import type { ProximityMode, VoiceAdapter } from './adapter'

/**
 * Production VoiceAdapter that delegates to @nextvm/natives Voice.
 * Lazy-imported so the package builds and tests cleanly without
 * @nextvm/natives present (it's an optional peer dependency — only the
 * runtime layer pulls it in).
 */
export async function createNativesVoiceAdapter(): Promise<VoiceAdapter> {
	const { Voice } = (await import('@nextvm/natives')) as {
		Voice: {
			setProximity(source: number, mode: ProximityMode): void
			joinRadioChannel(source: number, channel: number): void
			leaveRadioChannel(source: number): void
			startCall(source: number, target: number): number
			endCall(source: number): void
			mutePlayer(source: number): void
			unmutePlayer(source: number): void
		}
	}
	return {
		setProximity: (source, mode) => Voice.setProximity(source, mode),
		setRadioChannel: (source, channel) => {
			if (channel === 0) Voice.leaveRadioChannel(source)
			else Voice.joinRadioChannel(source, channel)
		},
		setCallChannel: (source, channel) => {
			if (channel === 0) Voice.endCall(source)
			// startCall is symmetric and sets both endpoints — VoiceService
			// already calls setCallChannel for both parties, so we treat
			// each side as an idempotent join.
		},
		setMuted: (source, muted) => {
			if (muted) Voice.mutePlayer(source)
			else Voice.unmutePlayer(source)
		},
	}
}
