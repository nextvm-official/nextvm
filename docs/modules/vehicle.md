# @nextvm/vehicle

First-party vehicle module. Tracks owned vehicles per character and
exposes RPC procedures for spawning, despawning, repairing, and
listing.

## Install

```bash
pnpm add @nextvm/vehicle
```

```typescript
modules: ['@nextvm/vehicle']
```

## Dependencies

```typescript
dependencies: ['player']
```

## Config

| Field | Type | Default | Description |
|---|---|---|---|
| `maxOwnedVehicles` | int (0–100) | 5 | Maximum vehicles a character can own |

## State

`vehicleState`:

| Field | Type | Default |
|---|---|---|
| `ownedNetIds` | `number[]` | `[]` |

## RPC procedures

| Procedure | Type | Input | Description |
|---|---|---|---|
| `spawn` | mutation | `{ modelHash, x, y, z, heading? }` | Spawns a vehicle, adds the netId to ownership |
| `despawn` | mutation | `{ netId }` | Despawns an owned vehicle |
| `repair` | mutation | `{ netId }` | Repairs an owned vehicle |
| `getMyVehicles` | query | — | Returns the calling player's owned netIds |

## Server-authoritative ownership

All ownership checks happen server-side. The `despawn` and `repair`
procedures verify that the calling character owns the netId before
proceeding — clients can't despawn other players' cars.

## See also

- [`@nextvm/natives` NextVMVehicle](/packages/natives)
- [`@nextvm/player`](/modules/player)
