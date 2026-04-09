/**
 * @nextvm/discord types.
 */

/** Map of channel keys (used by autoLog) to Discord channel names */
export type ChannelMap = Record<string, string>

/** Configuration for defineDiscord() */
export interface DiscordConfig {
	/** Discord bot token (DISCORD_BOT_TOKEN) */
	botToken: string
	/** Discord guild ID where the bot operates */
	guildId: string
	/** Channel name aliases used by autoLog and other features */
	channels: ChannelMap
	/** Optional: prefix for status bot messages */
	statusBotPrefix?: string
}

/** Mapping of Discord role names to NextVM permission strings */
export type RoleSyncMap = Record<string, string>

/** Mapping of NextVM event names to channel keys (from ChannelMap) */
export type AutoLogMap = Record<string, string>

/** Whitelist configuration */
export interface WhitelistConfig {
	enabled: boolean
	requiredRoles: string[]
	denyMessage: string
}

/**
 * Staff Chat Bridge configuration.
 * channel and vice versa."
 */
export interface StaffChatBridgeConfig {
	/** Channel key (from ChannelMap) used as the bridge channel */
	channelKey: string
	/**
	 * Called when a Discord message arrives in the bridge channel.
	 * Implementation should forward it to the in-game staff chat.
	 */
	onDiscordMessage: (msg: { author: string; content: string }) => void | Promise<void>
}

/** Status bot configuration */
export interface StatusBotConfig {
	channelKey: string
	updateIntervalSec?: number
	getServerStatus: () => Promise<{
		playerCount: number
		maxPlayers: number
		uptimeSec: number
		nextRestartAt?: Date
	}>
}

/** Log entry forwarded to a Discord channel */
export interface LogEntry {
	title: string
	description?: string
	color?: number
	fields?: Array<{ name: string; value: string; inline?: boolean }>
}
