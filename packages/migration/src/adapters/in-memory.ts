import type {
	LegacyPlayer,
	MigrationSource,
	MigrationTarget,
} from '../types'

/**
 * InMemoryMigrationSource — testing helper.
 *
 * Pass a static list of legacy players and the source iterates over them.
 * Used by every test in @nextvm/migration so suites stay free of real
 * databases. Production code uses EsxMigrationSource / QbCoreMigrationSource.
 */
export class InMemoryMigrationSource implements MigrationSource {
	readonly framework = 'memory' as const

	constructor(private readonly players: LegacyPlayer[]) {}

	async count(): Promise<number> {
		return this.players.length
	}

	async *listPlayers(): AsyncIterable<LegacyPlayer> {
		for (const p of this.players) yield p
	}
}

/**
 * InMemoryMigrationTarget — testing helper.
 *
 * Records every insertUser + insertCharacter call so tests can assert
 * on the resulting NextVM rows without touching a real database.
 */
export interface RecordedUser {
	id: number
	license: string
	discord: string | null
	steam: string | null
}

export interface RecordedCharacter {
	id: number
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
}

export class InMemoryMigrationTarget implements MigrationTarget {
	readonly users: RecordedUser[] = []
	readonly characters: RecordedCharacter[] = []
	private nextUserId = 1
	private nextCharId = 1

	async insertUser(input: {
		license: string
		discord: string | null
		steam: string | null
	}): Promise<{ id: number }> {
		const id = this.nextUserId++
		this.users.push({ id, ...input })
		return { id }
	}

	async insertCharacter(input: Omit<RecordedCharacter, 'id'>): Promise<{ id: number }> {
		const id = this.nextCharId++
		this.characters.push({ id, ...input })
		return { id }
	}
}
