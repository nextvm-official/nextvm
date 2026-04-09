# @nextvm/inventory

First-party inventory module. Slot-based inventory with weight + stack
limits, item registry, server-authoritative add/use/move/drop.

## Install

```bash
pnpm add @nextvm/inventory
```

```typescript
modules: ['@nextvm/inventory']
```

## Dependencies

```typescript
dependencies: ['player']
```

## Config

| Field | Type | Default | Description |
|---|---|---|---|
| `maxSlots` | int (1–200) | 40 | Maximum slots per character |
| `maxWeightKg` | number (1–500) | 50 | Maximum carry weight in kg |

## ItemRegistry

Defines available items at module init:

```typescript
import { ItemRegistry, defineItem } from '@nextvm/inventory'

const registry = new ItemRegistry()
registry.define(defineItem({
  id: 'water_bottle',
  labelKey: 'inventory.items.water_bottle',
  weight: 0.5,
  stackable: true,
  maxStack: 10,
  category: 'consumable',
}))
```

The module ships seed items on startup: `water_bottle`, `bread`, `phone`.

## State

`inventoryState`:

| Field | Type | Default |
|---|---|---|
| `slots` | `Array<{ slot: number, stack: { itemId, count } }>` | `[]` |

## RPC procedures

| Procedure | Type | Input | Description |
|---|---|---|---|
| `getMyInventory` | query | — | Returns the calling player's slots |
| `useItem` | mutation | `{ slot }` | Decrements the stack at the given slot |
| `dropItem` | mutation | `{ slot, count }` | Removes `count` items from a slot |
| `moveItem` | mutation | `{ fromSlot, toSlot }` | Moves or swaps stacks between slots |
| `addItem` | mutation | `{ itemId, count }` | Server: adds items respecting weight + stack limits |

## Server-side validation

`addItem` enforces:

- Item exists in the registry → otherwise `VALIDATION_ERROR`
- Total weight <= `maxWeightKg` → otherwise `VALIDATION_ERROR`
- No more than `maxSlots` → otherwise `VALIDATION_ERROR`
- Stacks respect `maxStack`

## PLA note

This module manages **in-game items only**. It does NOT process
payments. Modules built on top that sell items to players for real
money must integrate via `@nextvm/tebex` and ship a `MONETIZATION.md`).

## See also

- [PLA Compliance](/guide/pla-compliance)
- [`@nextvm/tebex`](/packages/tebex)
