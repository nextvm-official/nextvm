# @nextvm/discord

Optional Discord bot integration. Role sync (Discord → NextVM ACE),
event log channels, whitelist on connect, staff chat bridge, status bot.

## Install

```bash
pnpm add @nextvm/discord
```

## defineDiscord

```typescript
import { defineDiscord } from '@nextvm/discord'

const discord = defineDiscord({
  botToken: process.env.DISCORD_BOT_TOKEN!,
  guildId: process.env.DISCORD_GUILD_ID!,
  channels: {
    logs: 'server-logs',
    bans: 'ban-log',
    joinLeave: 'join-leave',
    staff: 'staff-chat',
  },
  statusBotPrefix: 'NextVM Server Status',
})
```

## Five features

### 1. Role Sync

```typescript
discord.roleSync({
  VIP: 'nextvm.vip',
  Police: 'nextvm.jobs.police',
  Admin: 'nextvm.admin',
})
```

When a player connects, the bot fetches their Discord roles and
grants the matching NextVM permissions via the `PermissionsService`.

### 2. Auto Log

```typescript
discord.autoLog({
  'player:join': 'joinLeave',
  'player:leave': 'joinLeave',
  'admin:ban': 'bans',
  'admin:kick': 'logs',
})
```

Subscribes to events on the NextVM event bus and forwards them to
the configured Discord channels with rich embeds.

### 3. Whitelist

```typescript
discord.whitelist({
  enabled: true,
  requiredRoles: ['Whitelisted'],
  denyMessage: 'Join our Discord to get whitelisted.',
})
```

Use the result of `discord.checkWhitelist(discordId)` from your
module's `onPlayerConnecting` hook to defer or reject connections.

### 4. Staff Chat Bridge

```typescript
discord.staffChatBridge({
  channelKey: 'staff',
  onDiscordMessage: async ({ author, content }) => {
    await sendInGameStaffChat(`[Discord] ${author}: ${content}`)
  },
})

// From the in-game admin chat:
await discord.sendStaffMessage('Tom', 'restart in 5 minutes')
```

### 5. Status Bot

```typescript
discord.statusBot({
  channelKey: 'logs',
  updateIntervalSec: 60,
  getServerStatus: async () => ({
    playerCount: getPlayerCount(),
    maxPlayers: 32,
    uptimeSec: process.uptime(),
    nextRestartAt: new Date('2026-04-09T03:00:00Z'),
  }),
})
```

## Lifecycle

```typescript
// At server boot:
await discord.start({
  permissions: permissionsService,
  eventBus: loader.getEventBus(),
})

// On shutdown:
await discord.stop()
```

`start()` connects the bot, fetches the guild + member list, wires
the auto-log subscriptions, and starts the status bot timer.

## See also

- [com/nextvm-official/nextvm/tree/main/docs/concept)
- [Permissions](/concept/permissions)
