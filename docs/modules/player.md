# @nextvm/player

First-party player module. Owns the runtime per-character state for
position, health, armor, and alive/dead status, plus the player RPC
router (teleport, revive, setHealth).

## Install

```bash
pnpm add @nextvm/player
```

Then list it in `nextvm.config.ts`:

```typescript
modules: ['@nextvm/player', /* ... */]
```

## Config

| Field | Type | Default | Description |
|---|---|---|---|
| `startingHealth` | int (1–200) | 100 | Initial health value when a character spawns |
| `respawnCoords` | `{ x, y, z }` | Pillbox Hospital | Coordinates used when reviving a player |

## State

`playerState` is a `defineState` container exported by the module:

| Field | Type | Default |
|---|---|---|
| `posX` | number | 0 |
| `posY` | number | 0 |
| `posZ` | number | 0 |
| `health` | number (0–200) | 100 |
| `armor` | number (0–100) | 0 |
| `isDead` | boolean | false |

All fields are character-scoped — keyed by `charId`,
not `source`.

## RPC procedures

| Procedure | Type | Input | Description |
|---|---|---|---|
| `getMe` | query | — | Returns the calling player's full state |
| `getPlayer` | query | `{ charId }` | Returns any character's state |
| `teleport` | mutation | `{ x, y, z }` | Teleports the calling player |
| `revive` | mutation | `{ charId }` | Resets health to 100 + isDead to false |
| `setHealth` | mutation | `{ charId, health }` | Admin: set a character's health (0–200) |

## Events

| Event | Payload | Fired when |
|---|---|---|
| `player:spawned` | `{ charId, source }` | Character is fully loaded after onPlayerReady |
| `player:left` | `{ charId, source }` | Character disconnects |
| `player:mounted` | `{}` | Client `onMounted` fires |

## Dependencies

None — `@nextvm/player` is the foundation that other modules
(`@nextvm/banking`, `@nextvm/jobs`, `@nextvm/housing`, `@nextvm/inventory`,
...) depend on.

## See also

- [State Management](/concept/state-management)
- [`@nextvm/core`](/packages/core)
