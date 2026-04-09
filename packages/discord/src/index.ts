/**
 * @nextvm/discord — Discord integration for NextVM
 *
 * Concept v2.3, Chapter 30.
 *
 * Optional package. Server operators who want custom Discord logic can
 * use discord.js directly. This package provides typed, opinionated
 * helpers for the most common features:
 *   - Role Sync (Discord → NextVM ACE)
 *   - Auto Log (NextVM event bus → Discord embeds)
 *   - Whitelist (block connections without required Discord roles)
 *   - Staff Chat Bridge (in-game ↔ Discord channel)
 *   - Status Bot (periodic player count / uptime)
 *
 * Uses Discord.js v14 internally.
 */

export { DiscordService } from './discord-service'
export { defineDiscord } from './define-discord'
export type {
	DiscordConfig,
	ChannelMap,
	RoleSyncMap,
	AutoLogMap,
	WhitelistConfig,
	StaffChatBridgeConfig,
	StatusBotConfig,
	LogEntry,
} from './types'
