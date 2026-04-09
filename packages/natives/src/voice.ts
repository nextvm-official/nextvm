import type { PlayerSource, VoiceProximity } from './types'

/**
 * Voice — Typed wrapper around pma-voice.
 *   Does NOT replace pma-voice — wraps it with a typed API.
 *   Optional package (@nextvm/voice in concept, included in @nextvm/natives for ).
 * Note: pma-voice uses FiveM exports and Player State Bags.
 * These methods call pma-voice exports under the hood.
 */
export class Voice {
	private constructor() {}

	/** Call a pma-voice export safely */
	private static call(method: string, ...args: unknown[]): unknown {
		const pmaVoice = exports['pma-voice']
		if (!pmaVoice) {
			throw new Error('pma-voice resource is not running. Voice requires pma-voice.')
		}
		const fn = pmaVoice[method]
		if (typeof fn !== 'function') {
			throw new Error(`pma-voice export '${method}' not found.`)
		}
		return (fn as (...a: unknown[]) => unknown)(...args)
	}

	/**
	 * Set a player's voice proximity mode.
	 * Concept API: nextvm.voice.setProximity(source, 'normal')
	 */
	static setProximity(source: PlayerSource, mode: VoiceProximity): void {
		const distances: Record<VoiceProximity, number> = {
			whisper: 5.0,
			normal: 15.0,
			shout: 30.0,
		}
		const modeIndex: Record<VoiceProximity, number> = {
			whisper: 1,
			normal: 2,
			shout: 3,
		}

		const player = Player(String(source))
		if (player?.state) {
			player.state.set('proximity', {
				index: modeIndex[mode],
				distance: distances[mode],
				mode,
			}, true)
		}
	}

	/**
	 * Join a radio channel.
	 * Concept API: nextvm.voice.joinRadioChannel(source, 1)
	 */
	static joinRadioChannel(source: PlayerSource, channel: number): void {
		Voice.call('setPlayerRadio', source, channel)
	}

	/**
	 * Leave the current radio channel.
	 * Concept API: nextvm.voice.leaveRadioChannel(source)
	 */
	static leaveRadioChannel(source: PlayerSource): void {
		Voice.call('setPlayerRadio', source, 0)
	}

	/**
	 * Start a phone call between two players.
	 * Concept API: nextvm.voice.startCall(source, targetSource)
	 */
	static startCall(source: PlayerSource, target: PlayerSource): number {
		const callChannel = Math.min(source, target) * 10000 + Math.max(source, target)
		Voice.call('setPlayerCall', source, callChannel)
		Voice.call('setPlayerCall', target, callChannel)
		return callChannel
	}

	/**
	 * End a phone call for a player.
	 * Concept API: nextvm.voice.endCall(source)
	 */
	static endCall(source: PlayerSource): void {
		Voice.call('setPlayerCall', source, 0)
	}

	/**
	 * Mute a player's voice.
	 * Concept API: nextvm.voice.mutePlayer(source, { duration: 300 })
	 */
	static mutePlayer(source: PlayerSource, opts?: { duration?: number }): void {
		const player = Player(String(source))
		if (player?.state) {
			player.state.set('muted', true, true)
		}

		if (opts?.duration) {
			setTimeout(() => {
				Voice.unmutePlayer(source)
			}, opts.duration * 1000)
		}
	}

	/** Unmute a player's voice */
	static unmutePlayer(source: PlayerSource): void {
		const player = Player(String(source))
		if (player?.state) {
			player.state.set('muted', false, true)
		}
	}

	/** Get all players currently in a radio channel */
	static getPlayersInRadioChannel(channel: number): Record<PlayerSource, boolean> {
		return Voice.call('getPlayersInRadioChannel', channel) as Record<PlayerSource, boolean>
	}

	/** Add an access check for a radio channel */
	static addChannelCheck(
		channel: number,
		check: (source: PlayerSource) => boolean,
	): void {
		Voice.call('addChannelCheck', channel, check)
	}
}
