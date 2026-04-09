# @nextvm/natives

Layer 2 of the architecture: typed wrappers around FiveM natives.
Modules are forbidden from calling raw natives — they
go through these abstractions.

## Install

```bash
pnpm add @nextvm/natives
```

## Domain wrappers

/1 ships seven of the twelve domains from 1:

| Domain | Class | Wraps |
|---|---|---|
| Entity | `NextVMEntity` | Generic entity natives — base class for Player + Vehicle |
| Player | `NextVMPlayer extends NextVMEntity` | Ped natives, identifiers, health, armor, weapons |
| Vehicle | `NextVMVehicle extends NextVMEntity` | Vehicle natives, mods, fuel, damage, doors, locks |
| World | `World` (static) | Weather, time, blips, markers |
| Network | `Network` (static) | State bags, events, player utilities |
| Routing | `RoutingService` | Managed routing buckets / instancing |
| Voice | `Voice` (static) | pma-voice wrapper |
| Permissions | `Permissions` (static) | ACE / IsPlayerAceAllowed |

## Escape hatches

| Symbol | Purpose | See |
|---|---|---|
| `useNative<T>(name, ...args)` | Direct typed access to any FiveM native | [Tick System](/concept/tick-system) |
| `createBatchProcessor(opts)` | Spread heavy entity work across many ticks | [Tick System](/concept/tick-system) |

## Types

| Type | Purpose |
|---|---|
| `Vec3` | `{ x, y, z }` 3D vector used throughout the framework |
| `EntityHandle` | Numeric entity handle |
| `PlayerSource` | Server source ID |
| `BucketId` | Routing bucket id |
| `NetworkId` | Network ID for synced entities |
| `VehicleSeat` | Driver / Passenger / LeftRear / RightRear enum |
| `VoiceProximity` | `'whisper' | 'normal' | 'shout'` |
| `WeatherType` | Standard GTA V weather names |
| `BlipConfig` | Config for `World.createBlip` |
| `MarkerConfig` | Config for `World.drawMarker` |
| `RoutingInstanceConfig` | Config for `RoutingService.createInstance` |
| `RoutingInstance` | The handle returned by `createInstance` |

## Encapsulation pattern


```typescript
// Raw FiveM:
SetEntityCoords(entity, x, y, z, false, false, false, false)

// NextVM:
entity.setPosition({ x, y, z })
```

The wrappers are thin — they don't add behavior, just types and
ergonomics. Performance overhead is < 5% vs raw natives (Concept
benchmark target).

## Deferred to +

The remaining five domains from 1 are not yet
shipped:

- UI (NUI bridge)
- Input (key bindings, commands)
- Streaming (asset loading)
- Camera (cam transitions)
- Audio (sound natives)

These are documented as deferred in
[`packages/natives/src/index.ts`](https://github.com/nextvm-official/nextvm/blob/main/packages/natives/src/index.ts).

## Tests

`packages/natives/__tests__/` covers `RoutingService`,
`createBatchProcessor`, and `useNative` with stubbed FiveM globals.
Other domain wrappers are integration-tested via the demo bundle on
a real FXServer.
