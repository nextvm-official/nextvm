import { DiscordService } from './discord-service'
import type { DiscordConfig } from './types'

/**
 * Define a Discord integration.
 *
 * Concept v2.3, Chapter 30.1:
 *   const discord = defineDiscord({
 *     botToken: process.env.DISCORD_BOT_TOKEN,
 *     guildId: process.env.DISCORD_GUILD_ID,
 *     channels: {
 *       logs: 'server-logs',
 *       bans: 'ban-log',
 *       joinLeave: 'join-leave',
 *       staff: 'staff-chat',
 *     },
 *   })
 *
 *   discord.roleSync({ VIP: 'nextvm.vip', Admin: 'nextvm.admin' })
 *   discord.autoLog({ 'player:join': 'joinLeave', 'admin:ban': 'bans' })
 *   discord.whitelist({ enabled: true, requiredRoles: ['Whitelisted'], denyMessage: '...' })
 *
 *   await discord.start({ permissions, eventBus })
 */
export function defineDiscord(config: DiscordConfig): DiscordService {
	return new DiscordService(config)
}
