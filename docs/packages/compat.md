# @nextvm/compat

ESX and QBCore export compatibility layer. Lets legacy Lua resources
keep working alongside NextVM modules during a migration.

## Install

```bash
pnpm add @nextvm/compat
```

## setupCompat

```typescript
import { setupCompat, InMemoryExportsApi } from '@nextvm/compat'

setupCompat({
  dataSource: buildDataSource(characters, inventoryState),
  exportsApi: realFivemExportsApi,
  enable: { esx: true, qbcore: true },
})
```

After this runs, legacy Lua scripts can call:

```lua
local ESX = exports['es_extended']:getSharedObject()
local QBCore = exports['qb-core']:GetCoreObject()
```

and receive properly-shaped `xPlayer` / `Player` objects backed by
NextVM data.

## CompatDataSource

The data source is a small port that resolves a server source ID to
a NextVM character snapshot:

```typescript
import type { CompatDataSource } from '@nextvm/compat'

const dataSource: CompatDataSource = {
  getCharacter(source) {
    const session = characters.getSession(source)
    if (!session?.character) return null
    return {
      source,
      charId: session.character.id,
      identifiers: {
        license: session.user.license,
        discord: session.user.discord,
        steam: session.user.steam,
      },
      firstName: session.character.firstName,
      lastName: session.character.lastName,
      cash: session.character.cash,
      bank: session.character.bank,
      job: session.character.job,
      jobGrade: 0,
      position: session.character.position,
      inventory: getInventoryItems(session.character.id),
    }
  },
  getActiveSources() {
    return characters.getActivePlayers().map((s) => s.source)
  },
}
```

## ESX mapper

`toEsxPlayer(snapshot)` builds an `xPlayer` with `getName`,
`getMoney`, `getAccount`, `getJob`, `getInventoryItem`, `getCoords`,
`getIdentifier`. Import it directly if you need to wrap individual
players outside the exports flow:

```typescript
import { toEsxPlayer } from '@nextvm/compat'

const xPlayer = toEsxPlayer(snapshot)
console.log(xPlayer.getName(), xPlayer.getMoney())
```

## QBCore mapper

`toQbPlayer(snapshot)` builds a `Player` with `PlayerData`
(charinfo, money, job, items, position) and `Functions`
(`GetMoney`, `AddMoney`, `RemoveMoney`, `GetName`, `GetCoords`).

## ExportsApi

The exports registration is abstracted behind an `ExportsApi`
interface so the package is testable on plain Node:

```typescript
import { InMemoryExportsApi } from '@nextvm/compat'

const exportsApi = new InMemoryExportsApi()
setupCompat({ dataSource, exportsApi })

// In tests:
const shared = exportsApi.call('es_extended', 'getSharedObject')
```

The real FiveM-backed implementation lives in the server bootstrap
layer (it calls the global `exports[resource][name] = fn` pattern).

## See also

- [Compatibility Layer concept](/concept/compatibility-layer)
- [Migration from ESX](/guide/migration-from-esx)
- [Migration from QBCore](/guide/migration-from-qbcore)
