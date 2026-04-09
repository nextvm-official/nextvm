/**
 * @nextvm/compat — ESX/QBCore compatibility layer
 * Lets legacy Lua resources (esx_*, qb-*) run unmodified alongside
 * NextVM modules. The compat layer:
 *   - Registers `exports['es_extended']` with getSharedObject()
 *   - Registers `exports['qb-core']` with GetCoreObject()
 *   - Maps NextVM character + inventory state into the legacy formats
 * Scope (80/20): player data, money, job, inventory. Exotic
 * framework-specific features are out of scope.
 * Usage (in the server bootstrap):
 *   import { setupCompat } from '@nextvm/compat'
 *   setupCompat({
 *     dataSource: buildDataSource(characters, inventoryState),
 *     exportsApi: realFivemExportsApi,
 *   })
 */

export { setupCompat } from './setup'
export type { SetupCompatOptions } from './setup'
export { registerEsxExports, toEsxPlayer } from './esx-mapper'
export type { EsxPlayer, EsxJob, EsxAccount, EsxItem } from './esx-mapper'
export { registerQbExports, toQbPlayer } from './qbcore-mapper'
export type { QbPlayer, QbPlayerData, QbCharInfo, QbMoney, QbJob, QbItem } from './qbcore-mapper'
export { InMemoryExportsApi } from './exports-api'
export type {
	CompatDataSource,
	CompatCharacterSnapshot,
	CompatItem,
	CompatIdentifiers,
	ExportsApi,
} from './types'
