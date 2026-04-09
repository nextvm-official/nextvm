# State Management

> Concept v2.3, Chapter 11

NextVM wraps FiveM State Bags with type safety, character scoping,
reactivity, and Hot-Reload preservation. State is **always
character-scoped** by [GUARD-011](/reference/guards#guard-011-character-scoped-data).

## defineState

```typescript
import { defineState, z } from '@nextvm/core'

export const playerState = defineState('player', {
  job: z.string().default('unemployed').describe('Current job name'),
  cash: z.number().default(0).describe('On-hand money'),
  bank: z.number().default(500).describe('Bank balance'),
  isDead: z.boolean().default(false).describe('True if dead'),
})
```

The first argument is the state's name. The second is a Zod object
shape — every field needs `.default()` so the framework knows what
to return when no value has been set.

## Reading + writing

```typescript
// Set
playerState.set(charId, 'cash', 1500)

// Get (returns the schema default if unset)
const cash = playerState.get(charId, 'cash')

// Increment numeric fields
const newBalance = playerState.increment(charId, 'cash', 500)

// Get the full state object for a character
const all = playerState.getAll(charId)
```

Every `set()` call validates the value against the field's Zod
schema. Writing the wrong type throws a clear error.

## Subscriptions

```typescript
const unsubscribe = playerState.subscribe(charId, 'job', (newJob, oldJob) => {
  console.log(`${charId} moved from ${oldJob} to ${newJob}`)
  syncDiscordRole(charId, newJob)
})

// Later:
unsubscribe()
```

Subscribers are character-scoped — you only get notified about
mutations to the specific `charId` you subscribed to. If a subscriber
throws, the error is logged but other subscribers still run.

## Character scoping (GUARD-011)

Every read and write takes a `charId`, **never** a `source`. This is
because the same player (source) can switch between multiple
characters during a session, and game state must follow the
character, not the connection.

```typescript
// ❌ Wrong
playerState.set(player.source, 'cash', 100)

// ✅ Right
playerState.set(player.character.id, 'cash', 100)
```

The `nextvm validate` command soft-warns when it detects `source`
being used as a state key.

## Backends

`StateStore` accepts an optional `StateBackend` for persistence:

```typescript
import { defineState, StateBagBackend } from '@nextvm/core'

const playerState = defineState('player', { ... }, {
  backend: new StateBagBackend(),
})
```

`StateBagBackend` writes every mutation to the FiveM Global State Bags
(via `@nextvm/natives/Network`), which auto-syncs to clients via OneSync.
For tests, omit the backend — the in-memory cache is enough.

You can also write your own backend (for example, a Redis-backed one
for clustered servers).

## Hot-reload preservation

When a resource restarts, in-memory state is normally lost. NextVM's
state stores serialize themselves before restart and deserialize after:

```typescript
// Before restart
const snapshot = playerState.serialize()
// → { 1: { cash: 100, job: 'police' }, 2: { cash: 50, job: 'taxi' } }

// After restart
playerState.deserialize(snapshot)
```

This is wired automatically by the dev orchestrator when modules opt
in (Concept Chapter 15.2).

## Example: full module integration

```typescript
import { defineModule, defineState, z } from '@nextvm/core'

const playerState = defineState('player', {
  cash: z.number().default(500),
  job: z.string().default('unemployed'),
})

export default defineModule({
  name: 'player',
  version: '0.1.0',

  config: z.object({}),

  server: (ctx) => {
    ctx.onPlayerReady(async (player) => {
      // Load defaults for the new character
      playerState.set(player.character.id, 'cash', 500)
    })

    ctx.onPlayerDropped(async (player) => {
      // Drop the in-memory entry to free RAM
      playerState.clear(player.character.id)
    })
  },

  client: () => {},
})

export { playerState }
```

## See also

- [`@nextvm/core` state API](/packages/core)
- [Character System](/concept/character-system)
- [GUARD-011](/reference/guards#guard-011-character-scoped-data)
