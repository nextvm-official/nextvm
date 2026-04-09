# Compatibility Layer

> 

`@nextvm/compat` exposes ESX- and QBCore-shaped exports backed by
NextVM data, so legacy Lua resources can keep working alongside
NextVM modules during a migration. This is the **incremental adoption
path** — there is no big-bang switch.

## The 80/20 scope

The compat layer covers the **80% most-used** legacy APIs:

- Player data (name, identifier, coords)
- Money (cash, bank, accounts)
- Job + grade
- Inventory items

Exotic framework-specific features (custom job APIs, framework forks,
modified data shapes) are out of scope. The goal is enough coverage
that `qb-ambulancejob`, `esx_policejob`, `esx_phone`, and similar
mainstream resources keep working without modification.

## Setup

```typescript
import { setupCompat, InMemoryExportsApi } from '@nextvm/compat'

setupCompat({
  dataSource: buildDataSource(characters, inventoryState),
  exportsApi: realFivemExportsApi,
  enable: { esx: true, qbcore: true },
})
```

The data source is a thin port that resolves a server source ID to a
NextVM character snapshot. The exports API is a thin wrapper over
FiveM's global `exports[]` table, kept abstract so the package is
testable on plain Node.

## What gets exposed

After `setupCompat()` runs:

```lua
-- Legacy ESX scripts
local ESX = exports['es_extended']:getSharedObject()
local xPlayer = ESX.GetPlayerFromId(source)
print(xPlayer.getName())
print(xPlayer.getMoney())
print(xPlayer.getAccount('bank').money)

-- Legacy QBCore scripts
local QBCore = exports['qb-core']:GetCoreObject()
local Player = QBCore.Functions.GetPlayer(source)
print(Player.PlayerData.charinfo.firstname)
print(Player.PlayerData.money.cash)
```

The compat layer translates each call into a read against the NextVM
character + inventory state and returns a properly-shaped object.

## ESX mapper

`toEsxPlayer(snapshot)` builds an `xPlayer` with:

| ESX field | Source |
|---|---|
| `xPlayer.source` | NextVM character source |
| `xPlayer.identifier` | `nextv_users.license` |
| `xPlayer.accounts[]` | money + bank + black_money |
| `xPlayer.job` | `{ name, label, grade, grade_label, grade_name, grade_salary }` |
| `xPlayer.inventory[]` | mapped from NextVM inventory state |
| `xPlayer.getName()` | `firstName + ' ' + lastName` |
| `xPlayer.getMoney()` | `cash` |
| `xPlayer.getCoords()` | `position` |

## QBCore mapper

`toQbPlayer(snapshot)` builds a `Player` with:

| QBCore field | Source |
|---|---|
| `PlayerData.source` | NextVM character source |
| `PlayerData.citizenid` | `nextv_users.license` (or `NEXTV<charId>`) |
| `PlayerData.charinfo` | firstname / lastname / birthdate / cid |
| `PlayerData.money` | `{ cash, bank, crypto: 0 }` |
| `PlayerData.job` | name + label + grade.level + onduty |
| `PlayerData.items[]` | mapped from NextVM inventory state |
| `Functions.GetMoney(type)` | reads `PlayerData.money[type]` |
| `Functions.AddMoney(type, amount)` | mutates `PlayerData.money[type]` |
| `Functions.RemoveMoney(type, amount)` | same with negative |

## Adoption path


1. **Phase A** — Install NextVM alongside ESX/QBCore. Enable
   `@nextvm/compat`. Existing Lua resources keep working. New
   features built as NextVM modules.
2. **Phase B** — Migrate high-value resources (inventory, banking,
   jobs) to NextVM modules one at a time. Each migration is
   independent.
3. **Phase C** — Once all critical resources are NextVM modules,
   disable `@nextvm/compat` and remove the legacy framework.

This can take weeks or months. There's no forced timeline.

## Limitations

- Compat is **read-mostly**. Mutations through `xPlayer.addMoney()`
  go through the corresponding NextVM banking service — they don't
  write to ESX-shaped tables.
- Custom forks of ESX/QBCore that ship modified field shapes may
  not be 1:1 compatible. In that case fork the compat mapper for
  your server.
- Framework-specific events (`esx:playerLoaded`, `QBCore:Client:OnPlayerLoaded`)
  are not bridged automatically. Listen to NextVM's `player:ready`
  event from your bridge instead.

## See also

- [`@nextvm/compat` package reference](/packages/compat)
- [Migration from ESX](/guide/migration-from-esx)
- [Migration from QBCore](/guide/migration-from-qbcore)
- [com/nextvm-official/nextvm/tree/main/docs/concept)
