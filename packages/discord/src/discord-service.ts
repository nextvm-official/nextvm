import {
	Client,
	EmbedBuilder,
	GatewayIntentBits,
	type Guild,
	type GuildMember,
	type TextChannel,
} from 'discord.js'
import { createLogger, type EventBus, type PermissionsService } from '@nextvm/core'
import type {
	AutoLogMap,
	DiscordConfig,
	LogEntry,
	RoleSyncMap,
	StaffChatBridgeConfig,
	StatusBotConfig,
	WhitelistConfig,
} from './types'

/**
 * DiscordService — High-level Discord integration for NextVM.
 *
 * Concept v2.3, Chapter 30.
 *
 * Features:
 *   - Role Sync: Discord roles → NextVM ACE permissions (Chapter 30.2)
 *   - Auto Log: NextVM event bus → Discord embed messages
 *   - Whitelist: Block connections by required Discord roles
 *   - Status Bot: Periodic player count / uptime message
 *
 * GUARD-006 compliant: instance state, no globals.
 *
 * Usage:
 *   const discord = defineDiscord({ botToken, guildId, channels: { ... } })
 *   await discord.start({ permissions, eventBus })
 */
export class DiscordService {
	private client: Client | null = null
	private guild: Guild | null = null
	private channelCache = new Map<string, TextChannel>()
	private roleSyncMap: RoleSyncMap = {}
	private autoLogMap: AutoLogMap = {}
	private whitelistConfig: WhitelistConfig | null = null
	private statusBotConfig: StatusBotConfig | null = null
	private statusBotInterval: ReturnType<typeof setInterval> | null = null
	private staffChatBridgeConfig: StaffChatBridgeConfig | null = null
	private permissions: PermissionsService | null = null
	private eventBus: EventBus | null = null
	private log = createLogger('nextvm:discord')

	constructor(private readonly config: DiscordConfig) {}

	/**
	 * Start the Discord bot and connect to the configured guild.
	 * Wires up all configured features (role sync, auto log, whitelist, status bot).
	 */
	async start(opts: {
		permissions?: PermissionsService
		eventBus?: EventBus
	} = {}): Promise<void> {
		this.permissions = opts.permissions ?? null
		this.eventBus = opts.eventBus ?? null

		this.client = new Client({
			intents: [
				GatewayIntentBits.Guilds,
				GatewayIntentBits.GuildMembers,
				GatewayIntentBits.GuildMessages,
				GatewayIntentBits.MessageContent,
			],
		})

		await this.client.login(this.config.botToken)
		this.guild = await this.client.guilds.fetch(this.config.guildId)
		await this.guild.members.fetch()
		this.log.info('Discord bot connected', {
			guild: this.guild.name,
			memberCount: this.guild.memberCount,
		})

		this.wireAutoLog()
		this.wireStaffChatBridge()
		this.startStatusBot()
	}

	/**
	 * Stop the bot, clear timers, disconnect from Discord.
	 */
	async stop(): Promise<void> {
		if (this.statusBotInterval) {
			clearInterval(this.statusBotInterval)
			this.statusBotInterval = null
		}
		await this.client?.destroy()
		this.client = null
		this.guild = null
		this.channelCache.clear()
	}

	// --- Role Sync (Concept Chapter 30.1 + 30.2) ---

	/** Configure Discord role → NextVM permission mapping */
	roleSync(map: RoleSyncMap): this {
		this.roleSyncMap = { ...this.roleSyncMap, ...map }
		return this
	}

	/**
	 * Sync a Discord member's roles to NextVM permissions.
	 * Should be called when a player connects, after their Discord ID is known.
	 */
	async syncMemberPermissions(discordId: string, source: number): Promise<void> {
		if (!this.guild || !this.permissions) return
		const member = await this.guild.members.fetch(discordId).catch(() => null)
		if (!member) return

		for (const [discordRoleName, nextvmRole] of Object.entries(this.roleSyncMap)) {
			const role = this.guild.roles.cache.find((r) => r.name === discordRoleName)
			if (!role) continue
			if (member.roles.cache.has(role.id)) {
				this.permissions.grantRole(source, nextvmRole)
			}
		}
	}

	// --- Auto Log (Concept Chapter 30.1) ---

	/** Configure event → channel routing for automatic log forwarding */
	autoLog(map: AutoLogMap): this {
		this.autoLogMap = { ...this.autoLogMap, ...map }
		return this
	}

	/** Send a log entry to a configured channel key */
	async log_(channelKey: string, entry: LogEntry): Promise<void> {
		const channel = await this.getChannel(channelKey)
		if (!channel) return

		const embed = new EmbedBuilder().setTitle(entry.title)
		if (entry.description) embed.setDescription(entry.description)
		if (entry.color !== undefined) embed.setColor(entry.color)
		if (entry.fields) embed.addFields(entry.fields)
		embed.setTimestamp()

		await channel.send({ embeds: [embed] }).catch((err) => {
			this.log.warn('Failed to send Discord log', {
				channelKey,
				error: err instanceof Error ? err.message : String(err),
			})
		})
	}

	private wireAutoLog(): void {
		if (!this.eventBus) return
		for (const [eventName, channelKey] of Object.entries(this.autoLogMap)) {
			this.eventBus.on(eventName, (data) => {
				void this.log_(channelKey, {
					title: eventName,
					description: typeof data === 'string' ? data : '```json\n' + JSON.stringify(data, null, 2) + '\n```',
				})
			})
		}
	}

	// --- Whitelist (Concept Chapter 30.1 + 30.2) ---

	/** Configure Discord-based whitelist */
	whitelist(config: WhitelistConfig): this {
		this.whitelistConfig = config
		return this
	}

	/**
	 * Check if a Discord user is whitelisted.
	 * Should be called from a module's onPlayerConnecting handler.
	 *
	 * @returns null if allowed, deny message if rejected
	 */
	async checkWhitelist(discordId: string): Promise<string | null> {
		if (!this.whitelistConfig?.enabled) return null
		if (!this.guild) return this.whitelistConfig.denyMessage

		const member: GuildMember | null = await this.guild.members
			.fetch(discordId)
			.catch(() => null)
		if (!member) return this.whitelistConfig.denyMessage

		const requiredRoles = this.whitelistConfig.requiredRoles
		const hasRequired = requiredRoles.every((roleName) =>
			member.roles.cache.some((r) => r.name === roleName),
		)
		return hasRequired ? null : this.whitelistConfig.denyMessage
	}

	// --- Staff Chat Bridge (Concept Chapter 30.2) ---

	/**
	 * Configure the staff chat bridge.
	 * Discord messages in the bridge channel call onDiscordMessage.
	 * Use sendStaffMessage() to forward in-game staff chat to Discord.
	 */
	staffChatBridge(config: StaffChatBridgeConfig): this {
		this.staffChatBridgeConfig = config
		return this
	}

	/**
	 * Forward an in-game staff message to the Discord bridge channel.
	 * Should be called from the in-game staff chat module.
	 */
	async sendStaffMessage(author: string, content: string): Promise<void> {
		if (!this.staffChatBridgeConfig) return
		const channel = await this.getChannel(this.staffChatBridgeConfig.channelKey)
		if (!channel) return
		await channel.send(`**${author}**: ${content}`).catch((err) => {
			this.log.warn('Failed to forward staff message to Discord', {
				error: err instanceof Error ? err.message : String(err),
			})
		})
	}

	private wireStaffChatBridge(): void {
		if (!this.client || !this.staffChatBridgeConfig) return
		const config = this.staffChatBridgeConfig
		this.client.on('messageCreate', async (message) => {
			if (message.author.bot) return
			const channel = await this.getChannel(config.channelKey)
			if (!channel || message.channel.id !== channel.id) return
			try {
				await config.onDiscordMessage({
					author: message.author.username,
					content: message.content,
				})
			} catch (err) {
				this.log.warn('Staff chat bridge handler threw', {
					error: err instanceof Error ? err.message : String(err),
				})
			}
		})
	}

	// --- Status Bot (Concept Chapter 30.2) ---

	/** Configure the status bot */
	statusBot(config: StatusBotConfig): this {
		this.statusBotConfig = config
		return this
	}

	private startStatusBot(): void {
		if (!this.statusBotConfig) return
		const config = this.statusBotConfig
		const intervalMs = (config.updateIntervalSec ?? 60) * 1000

		const update = async () => {
			try {
				const status = await config.getServerStatus()
				const channel = await this.getChannel(config.channelKey)
				if (!channel) return
				const embed = new EmbedBuilder()
					.setTitle(`${this.config.statusBotPrefix ?? 'NextVM Server Status'}`)
					.addFields(
						{
							name: 'Players',
							value: `${status.playerCount} / ${status.maxPlayers}`,
							inline: true,
						},
						{
							name: 'Uptime',
							value: `${Math.floor(status.uptimeSec / 60)}m`,
							inline: true,
						},
					)
					.setTimestamp()
				if (status.nextRestartAt) {
					embed.addFields({
						name: 'Next Restart',
						value: status.nextRestartAt.toISOString(),
						inline: false,
					})
				}
				await channel.send({ embeds: [embed] })
			} catch (err) {
				this.log.warn('Status bot update failed', {
					error: err instanceof Error ? err.message : String(err),
				})
			}
		}

		this.statusBotInterval = setInterval(update, intervalMs)
	}

	// --- Internal helpers ---

	private async getChannel(channelKey: string): Promise<TextChannel | null> {
		const channelName = this.config.channels[channelKey]
		if (!channelName || !this.guild) return null

		const cached = this.channelCache.get(channelKey)
		if (cached) return cached

		const channel = this.guild.channels.cache.find(
			(c) => c.name === channelName && c.isTextBased(),
		) as TextChannel | undefined
		if (channel) {
			this.channelCache.set(channelKey, channel)
			return channel
		}
		this.log.warn('Discord channel not found', { channelKey, channelName })
		return null
	}
}
