/**
 * Migration toolkit types.
 *
 * Concept v2.3, Chapter 16.2.
 *
 * The toolkit is structured around three abstractions:
 *   - MigrationSource — reads rows from the legacy database (ESX or
 *     QBCore). Implementations live in adapters/esx-source.ts and
 *     adapters/qbcore-source.ts.
 *   - MigrationTarget — writes rows into the NextVM schema. The default
 *     implementation wraps an @nextvm/db Database; tests can supply an
 *     in-memory target.
 *   - runMigration() — orchestrates the source → target pipeline and
 *     emits a typed MigrationReport.
 *
 * GUARD-006: every adapter is instance-scoped, no globals.
 */

/** A row that the legacy framework knows about, normalized */
export interface LegacyPlayer {
	/** Stable identifier (license, citizenid, ...) */
	identifier: string
	/** Optional discord identifier */
	discord: string | null
	/** Optional steam identifier */
	steam: string | null
	firstName: string
	lastName: string
	dateOfBirth: string | null
	gender: string | null
	cash: number
	bank: number
	job: string
	jobGrade: number
	position: { x: number; y: number; z: number }
	inventory: LegacyInventoryItem[]
	vehicles: LegacyVehicle[]
}

export interface LegacyInventoryItem {
	name: string
	count: number
	slot?: number
	metadata?: Record<string, unknown>
}

export interface LegacyVehicle {
	plate: string
	model: string
	garage?: string | null
}

/**
 * Source-side abstraction.
 *
 * Implementations read from the legacy DB and yield normalized
 * LegacyPlayer rows. The default ESX + QBCore adapters live under
 * adapters/, but tests use the InMemoryMigrationSource.
 */
export interface MigrationSource {
	readonly framework: 'esx' | 'qbcore' | 'memory'
	/** Async iterator of legacy player rows */
	listPlayers(): AsyncIterable<LegacyPlayer>
	/** Optional pre-flight read used by --dry-run + the report header */
	count(): Promise<number>
	/** Optional close hook for connection pools */
	close?(): Promise<void>
}

/**
 * Target-side abstraction.
 *
 * Implementations write rows into the NextVM nextv_users and
 * nextv_characters tables (and friends). For tests we ship the
 * InMemoryMigrationTarget which keeps everything in memory.
 */
export interface MigrationTarget {
	insertUser(input: {
		license: string
		discord: string | null
		steam: string | null
	}): Promise<{ id: number }>
	insertCharacter(input: {
		userId: number
		slot: number
		firstName: string
		lastName: string
		dateOfBirth: string | null
		gender: string | null
		cash: number
		bank: number
		job: string
		position: { x: number; y: number; z: number }
		inventoryJson: string
		metadataJson: string
	}): Promise<{ id: number }>
	close?(): Promise<void>
}

/** Options for runMigration() */
export interface MigrationOptions {
	/** Don't actually write to the target — just count + warn */
	dryRun?: boolean
	/** Skip players whose identifier is missing or unparseable */
	skipMalformed?: boolean
	/** Per-row callback for progress UIs */
	onProgress?: (current: number, total: number) => void
}

/** Final report emitted by runMigration() */
export interface MigrationReport {
	framework: 'esx' | 'qbcore' | 'memory'
	startedAt: Date
	finishedAt: Date
	dryRun: boolean
	totalRowsRead: number
	usersInserted: number
	charactersInserted: number
	skipped: number
	warnings: MigrationWarning[]
	errors: MigrationError[]
}

export interface MigrationWarning {
	identifier: string | null
	message: string
}

export interface MigrationError {
	identifier: string | null
	message: string
	stack?: string
}
