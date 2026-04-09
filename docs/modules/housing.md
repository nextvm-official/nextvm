# @nextvm/housing

First-party housing module. Property definitions, ownership tracking,
apartment instancing via routing buckets, banking integration for
purchases.

## Install

```bash
pnpm add @nextvm/housing
```

```typescript
modules: ['@nextvm/housing']
```

## Dependencies

```typescript
dependencies: ['player', 'banking']
```

## Config

| Field | Type | Default | Description |
|---|---|---|---|
| `minPropertyPrice` | int >= 0 | 50000 | Lower bound applied when seed properties are loaded |

## Property registry

`PropertyDefinition`:

```typescript
interface PropertyDefinition {
  id: string
  label: string
  type: 'apartment' | 'house' | 'business' | 'warehouse'
  entrance: { x: number; y: number; z: number }
  price: number
  maxOccupants: number
}
```

The module seeds three example properties on startup:

| ID | Type | Price |
|---|---|---|
| `apt_eclipse_3` | apartment | 75000 |
| `apt_tinsel_42` | apartment | 90000 |
| `house_richman` | house | 1250000 |

Define more via `defineProperty()`:

```typescript
import { PropertyRegistry, defineProperty } from '@nextvm/housing'

const registry = new PropertyRegistry()
registry.define(defineProperty({
  id: 'shop_legion',
  label: 'Legion Square Shop',
  type: 'business',
  entrance: { x: 191, y: -806, z: 30 },
  price: 350000,
  maxOccupants: 6,
}))
```

## State

`housingState`:

| Field | Type | Default |
|---|---|---|
| `ownedPropertyIds` | `string[]` | `[]` |
| `currentInstanceId` | `string | null` | `null` |

## RPC procedures

| Procedure | Type | Input | Description |
|---|---|---|---|
| `getMyProperties` | query | — | Returns the calling character's owned properties |
| `listProperties` | query | — | Returns every defined property |
| `getNearbyProperties` | query | `{ x, y, z, radius? }` | Find properties within `radius` meters |
| `purchase` | mutation | `{ propertyId }` | Buy a property (debits banking, adds to ownership) |
| `enterProperty` | mutation | `{ propertyId }` | Move into the apartment instance |
| `leaveProperty` | mutation | — | Return to the main world |

## Apartment instancing

`enterProperty` uses `RoutingService.createInstance()` to spin up a
private routing bucket per character:

```typescript
const instance = routing.createInstance({
  label: `housing_${propertyId}_${charId}`,
  players: [source],
})
```

Other players in their own instances cannot see or hear the player
inside their apartment. `leaveProperty` calls `routing.resetPlayer()`
to return the player to bucket 0.

## Banking integration

`@nextvm/housing` consumes `@nextvm/banking` via the adapter pattern.
The interface is defined in the consumer (housing):

```typescript
// modules/housing/src/banking-adapter.ts
export interface BankingAdapter {
  removeMoney(
    charId: number,
    type: 'cash' | 'bank',
    amount: number,
    reason?: string,
  ): Promise<number>
}
```

The `purchase` flow debits the bank balance via the adapter and only
records ownership if the debit succeeded — atomic from the player's
perspective.

## HousingExports

```typescript
import type { HousingExports } from '@nextvm/housing'

const housing = ctx.inject<HousingExports>('housing')
const owned = housing.getOwned(charId)
```

## See also

- [Routing Buckets](/concept/character-system#routing-bucket-character-selection)
- [`@nextvm/natives` RoutingService](/packages/natives)
- [`@nextvm/banking`](/modules/banking)
