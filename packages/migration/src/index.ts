/**
 * @nextvm/migration — ESX/QBCore database migration toolkit
 * Reads existing player data from a legacy framework (ESX or QBCore)
 * and writes it into the NextVM nextv_users + nextv_characters tables.
 * Always non-destructive against the source — the caller is responsible
 * for backups before running.
 * Usage:
 *   import { runMigration, EsxMigrationSource, DbMigrationTarget } from '@nextvm/migration'
 *   const source = new EsxMigrationSource(esxDb)
 *   const target = new DbMigrationTarget(nextvmDb)
 *   const report = await runMigration(source, target, { onProgress })
 *   console.log(formatReport(report))
 */

export { runMigration, formatReport } from './runner'

export { EsxMigrationSource } from './adapters/esx-source'
export { QbCoreMigrationSource } from './adapters/qbcore-source'
export { DbMigrationTarget } from './adapters/db-target'
export {
	InMemoryMigrationSource,
	InMemoryMigrationTarget,
} from './adapters/in-memory'
export type {
	RecordedUser,
	RecordedCharacter,
} from './adapters/in-memory'

export type {
	LegacyPlayer,
	LegacyInventoryItem,
	LegacyVehicle,
	MigrationSource,
	MigrationTarget,
	MigrationOptions,
	MigrationReport,
	MigrationWarning,
	MigrationError,
} from './types'
