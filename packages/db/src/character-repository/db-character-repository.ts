import type {
	Character,
	CharacterRepository,
	CreateCharacterInput,
	User,
} from '@nextvm/core'
import type { Database } from '../database'
import { charactersTable, usersTable } from './schema'

/**
 * DbCharacterRepository — DB-backed implementation of CharacterRepository.
 * Implements the port defined in @nextvm/core using the @nextvm/db
 * query builder. This is the dependency-inversion pattern: core defines
 * the contract, db provides the implementation.
 */
export class DbCharacterRepository implements CharacterRepository {
	constructor(private readonly db: Database) {}

	async findUserByLicense(license: string): Promise<User | null> {
		const row = await this.db.query(usersTable).where({ license }).first()
		if (!row) return null
		return this.toUser(row)
	}

	async createUser(input: {
		license: string
		discord?: string | null
		steam?: string | null
	}): Promise<User> {
		const id = await this.db.insert(usersTable).one({
			license: input.license,
			discord: input.discord ?? null,
			steam: input.steam ?? null,
		})
		const row = await this.db.query(usersTable).where({ id }).first()
		if (!row) throw new Error(`Failed to load created user ${id}`)
		return this.toUser(row)
	}

	async touchUser(userId: number): Promise<void> {
		await this.db.update(usersTable).where({ id: userId }).set({
			lastSeen: new Date(),
		})
	}

	async findCharactersByUser(userId: number): Promise<Character[]> {
		const rows = await this.db.query(charactersTable).where({ userId }).all()
		return rows.map((r) => this.toCharacter(r))
	}

	async findCharacterById(charId: number): Promise<Character | null> {
		const row = await this.db.query(charactersTable).where({ id: charId }).first()
		if (!row) return null
		return this.toCharacter(row)
	}

	async createCharacter(input: CreateCharacterInput): Promise<Character> {
		const id = await this.db.insert(charactersTable).one({
			userId: input.userId,
			slot: input.slot,
			firstName: input.firstName,
			lastName: input.lastName,
			dateOfBirth: input.dateOfBirth,
			gender: input.gender,
		})
		const row = await this.db.query(charactersTable).where({ id }).first()
		if (!row) throw new Error(`Failed to load created character ${id}`)
		return this.toCharacter(row)
	}

	async saveCharacter(character: Character): Promise<void> {
		await this.db
			.update(charactersTable)
			.where({ id: character.id })
			.set({
				firstName: character.firstName,
				lastName: character.lastName,
				cash: character.cash,
				bank: character.bank,
				job: character.job,
				position: character.position,
				appearance: character.appearance,
				metadata: character.metadata,
				lastPlayed: new Date(),
			})
	}

	async deleteCharacter(charId: number): Promise<void> {
		await this.db.delete(charactersTable).where({ id: charId }).execute()
	}

	private toUser(row: Record<string, unknown>): User {
		return {
			id: row.id as number,
			license: row.license as string,
			discord: (row.discord as string | null) ?? null,
			steam: (row.steam as string | null) ?? null,
			lastSeen: new Date(row.lastSeen as string | Date),
			banned: Boolean(row.banned),
		}
	}

	private toCharacter(row: Record<string, unknown>): Character {
		return {
			id: row.id as number,
			userId: row.userId as number,
			slot: row.slot as number,
			firstName: row.firstName as string,
			lastName: row.lastName as string,
			dateOfBirth: row.dateOfBirth as string,
			gender: row.gender as string,
			cash: row.cash as number,
			bank: row.bank as number,
			job: row.job as string,
			position: this.parseJson<{ x: number; y: number; z: number }>(row.position) ?? {
				x: 0,
				y: 0,
				z: 0,
			},
			appearance: this.parseJson<Record<string, unknown>>(row.appearance) ?? {},
			metadata: this.parseJson<Record<string, unknown>>(row.metadata) ?? {},
			createdAt: new Date(row.createdAt as string | Date),
			lastPlayed: new Date(row.lastPlayed as string | Date),
		}
	}

	private parseJson<T>(value: unknown): T | null {
		if (value === null || value === undefined) return null
		if (typeof value === 'string') {
			try {
				return JSON.parse(value) as T
			} catch {
				return null
			}
		}
		return value as T
	}
}
