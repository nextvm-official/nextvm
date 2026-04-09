# Your First Module

This tutorial walks you through building a complete NextVM module from
scratch. We'll build a `mailbox` module that lets characters send and
read short text messages.

By the end you'll have:

- A typed service with character-scoped state
- A typed RPC router with Zod-validated inputs
- An en + de locale bundle
- Service tests and router tests
- A working `nextvm build` output

## 1. Scaffold

```bash
nextvm add mailbox --full
cd modules/mailbox
```

You now have:

```
modules/mailbox/
├── src/
│   ├── index.ts
│   ├── server/
│   │   ├── service.ts
│   │   └── router.ts
│   ├── client/index.ts
│   ├── shared/
│   │   ├── schemas.ts
│   │   ├── constants.ts
│   │   └── locales/{en,de}.ts
│   └── adapters/README.md
├── __tests__/
│   ├── service.test.ts
│   └── router.test.ts
├── package.json
├── tsconfig.json
├── tsup.config.ts
└── vitest.config.ts
```

## 2. Define the service

Open `src/server/service.ts` and replace the placeholder with:

```typescript
export interface MailboxMessage {
  id: number
  fromCharId: number
  toCharId: number
  body: string
  read: boolean
  sentAt: Date
}

export class MailboxService {
  private byCharacter = new Map<number, MailboxMessage[]>()
  private nextId = 1

  send(fromCharId: number, toCharId: number, body: string): MailboxMessage {
    if (body.length === 0 || body.length > 280) {
      throw new Error('INVALID_BODY')
    }
    const message: MailboxMessage = {
      id: this.nextId++,
      fromCharId,
      toCharId,
      body,
      read: false,
      sentAt: new Date(),
    }
    const inbox = this.byCharacter.get(toCharId) ?? []
    inbox.push(message)
    this.byCharacter.set(toCharId, inbox)
    return message
  }

  list(charId: number): MailboxMessage[] {
    return [...(this.byCharacter.get(charId) ?? [])]
  }

  markRead(charId: number, messageId: number): boolean {
    const inbox = this.byCharacter.get(charId)
    if (!inbox) return false
    const msg = inbox.find((m) => m.id === messageId)
    if (!msg) return false
    msg.read = true
    return true
  }

  unreadCount(charId: number): number {
    return this.list(charId).filter((m) => !m.read).length
  }

  clear(charId: number): void {
    this.byCharacter.delete(charId)
  }
}
```

This is **just TypeScript**. No NextVM imports. The service is testable
in isolation.

## 3. Define the router

Open `src/server/router.ts`:

```typescript
import { defineRouter, procedure, RpcError, z } from '@nextvm/core'
import type { MailboxService } from './service'

export function buildMailboxRouter(service: MailboxService) {
  return defineRouter({
    inbox: procedure.query(({ ctx }) => {
      if (!ctx.charId) throw new RpcError('NOT_FOUND', 'No active character')
      return service.list(ctx.charId)
    }),

    unreadCount: procedure.query(({ ctx }) => {
      if (!ctx.charId) throw new RpcError('NOT_FOUND', 'No active character')
      return { count: service.unreadCount(ctx.charId) }
    }),

    send: procedure
      .input(
        z.object({
          toCharId: z.number().int().positive(),
          body: z.string().min(1).max(280),
        }),
      )
      .mutation(({ input, ctx }) => {
        if (!ctx.charId) throw new RpcError('NOT_FOUND', 'No active character')
        try {
          const msg = service.send(ctx.charId, input.toCharId, input.body)
          return { ok: true, id: msg.id }
        } catch (err) {
          throw new RpcError(
            'VALIDATION_ERROR',
            err instanceof Error ? err.message : String(err),
          )
        }
      }),

    markRead: procedure
      .input(z.object({ messageId: z.number().int().positive() }))
      .mutation(({ input, ctx }) => {
        if (!ctx.charId) throw new RpcError('NOT_FOUND', 'No active character')
        const ok = service.markRead(ctx.charId, input.messageId)
        return { ok }
      }),
  })
}
```

Notes:

- Every procedure that takes input has `.input(z.object(...))`. The
  router's `nextvm validate` check enforces this for mutations.
- `ctx.source` and `ctx.charId` are injected by the framework — they
  are NOT spoofable from the wire payload.
- We map service errors to `RpcError` with the right code so the client
  can distinguish "your input was bad" from "the server crashed".

## 4. Wire it together

Open `src/index.ts`:

```typescript
import { defineExports, defineModule, z } from '@nextvm/core'
import enLocale from './shared/locales/en'
import deLocale from './shared/locales/de'
import { buildMailboxRouter } from './server/router'
import { MailboxService } from './server/service'

export type MailboxExports = ReturnType<typeof buildExports>
const buildExports = (service: MailboxService) =>
  defineExports({
    service,
    send: service.send.bind(service),
    list: service.list.bind(service),
    unreadCount: service.unreadCount.bind(service),
  })

export default defineModule({
  name: 'mailbox',
  version: '0.1.0',
  dependencies: ['player'],

  config: z.object({
    maxInboxSize: z
      .number()
      .int()
      .min(1)
      .max(10000)
      .default(500)
      .describe('Maximum messages retained per character before pruning'),
  }),

  server: (ctx) => {
    const config = ctx.config as { maxInboxSize: number }
    const service = new MailboxService()
    const router = buildMailboxRouter(service)

    ctx.log.info('mailbox loaded', {
      procedures: Object.keys(router).length,
      maxInboxSize: config.maxInboxSize,
    })

    ctx.setExports(buildExports(service))

    ctx.onPlayerDropped(async (player) => {
      service.clear(player.character.id)
    })
  },

  client: (ctx) => {
    ctx.log.info('mailbox client ready')
  },

  shared: {
    constants: { locales: { en: enLocale, de: deLocale } },
  },
})

export { MailboxService } from './server/service'
export { buildMailboxRouter } from './server/router'
```

## 5. Add locales

`src/shared/locales/en.ts`:

```typescript
import { defineLocale } from '@nextvm/i18n'

export default defineLocale({
  'mailbox.message_sent': 'Message sent.',
  'mailbox.invalid_body': 'Message must be 1-280 characters.',
  'mailbox.unread_count': 'You have {count} unread messages.',
})
```

`src/shared/locales/de.ts`:

```typescript
import { defineLocale } from '@nextvm/i18n'

export default defineLocale({
  'mailbox.message_sent': 'Nachricht gesendet.',
  'mailbox.invalid_body': 'Nachricht muss 1-280 Zeichen lang sein.',
  'mailbox.unread_count': 'Du hast {count} ungelesene Nachrichten.',
})
```

## 6. Write tests

Replace `__tests__/service.test.ts`:

```typescript
import { describe, expect, it } from 'vitest'
import { MailboxService } from '../src/server/service'

describe('MailboxService', () => {
  it('delivers messages to the recipient inbox', () => {
    const svc = new MailboxService()
    svc.send(1, 2, 'hi from 1')
    expect(svc.list(2)).toHaveLength(1)
    expect(svc.list(1)).toHaveLength(0)
  })

  it('rejects empty bodies', () => {
    const svc = new MailboxService()
    expect(() => svc.send(1, 2, '')).toThrow('INVALID_BODY')
  })

  it('rejects bodies longer than 280 characters', () => {
    const svc = new MailboxService()
    expect(() => svc.send(1, 2, 'x'.repeat(281))).toThrow('INVALID_BODY')
  })

  it('counts unread messages', () => {
    const svc = new MailboxService()
    svc.send(1, 2, 'a')
    svc.send(1, 2, 'b')
    expect(svc.unreadCount(2)).toBe(2)
  })

  it('markRead flips the read flag', () => {
    const svc = new MailboxService()
    const msg = svc.send(1, 2, 'a')
    svc.markRead(2, msg.id)
    expect(svc.unreadCount(2)).toBe(0)
  })
})
```

Replace `__tests__/router.test.ts`:

```typescript
import { createModuleHarness } from '@nextvm/test-utils'
import { describe, expect, it } from 'vitest'
import { buildMailboxRouter, MailboxService } from '../src'

const buildHarness = () => {
  const svc = new MailboxService()
  return {
    svc,
    harness: createModuleHarness({
      namespace: 'mailbox',
      router: buildMailboxRouter(svc),
    }),
  }
}

describe('mailbox router', () => {
  it('inbox returns the calling character messages', async () => {
    const { svc, harness } = buildHarness()
    svc.send(99, 1, 'hi')
    const result = await harness.dispatch(1, 'inbox')
    expect((result as { id: number }[]).length).toBe(1)
  })

  it('send rejects an empty body via Zod', async () => {
    const { harness } = buildHarness()
    await expect(
      harness.dispatch(1, 'send', { toCharId: 2, body: '' }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' })
  })

  it('markRead succeeds for a real message', async () => {
    const { svc, harness } = buildHarness()
    const msg = svc.send(2, 1, 'hi')
    const result = await harness.dispatch(1, 'markRead', { messageId: msg.id })
    expect(result).toEqual({ ok: true })
  })
})
```

## 7. Run the tests

```bash
pnpm --filter @nextvm/mailbox test
```

You should see:

```
✓ __tests__/service.test.ts (5 tests)
✓ __tests__/router.test.ts (3 tests)

 Test Files  2 passed (2)
      Tests  8 passed (8)
```

## 8. Build for FXServer

```bash
nextvm build
```

The output:

```
Building 1 module(s)
  ✓ @nextvm/mailbox (35ms)
✓ Built 1 module(s) in 35ms
```

You'll find:

- `modules/mailbox/dist/server.js` — bundled server code
- `modules/mailbox/dist/client.js` — bundled client code
- `modules/mailbox/dist/locales/en.json` and `de.json`
- `modules/mailbox/fxmanifest.lua`

Drop the `modules/mailbox/` folder into your FXServer's `resources/`
and `ensure mailbox` in `server.cfg`.

## 9. Validate

```bash
nextvm validate
```

This should report zero errors and zero warnings for the mailbox module —
because we used `nextvm add --full`, every check passes by construction.

## What we used

- **`defineModule`** for the wiring (lifecycle hooks + config validation)
- **`defineRouter` + `procedure`** for the typed RPC layer
- **`Zod`** for input validation
- **`defineLocale`** for type-safe i18n
- **`createModuleHarness`** for easy router tests
- **`ctx.setExports` + `defineExports`** to publish a typed service surface
- **`ctx.charId`** (not `source`) for character-scoped data
- **`RpcError`** with typed codes for client-distinguishable errors

## Next steps

- Add a database table for persistence — see [`@nextvm/db`](/packages/db)
- React to messages in another module via `ctx.events.on('mailbox:sent', ...)`
- Add admin permissions via [`PermissionsService`](/concept/permissions)
- Add more languages — every key in `en.ts` must exist in the other locales
