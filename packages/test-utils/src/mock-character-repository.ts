import type {
	Character,
	CharacterRepository,
	CreateCharacterInput,
	User,
} from '@nextvm/core'

/**
 * In-memory CharacterRepository for unit tests.
 *
 * Concept v2.3, Chapter 31:
 *   "createMockDb() — in-memory query builder"
 *
 * This implementation backs the CharacterService with plain Maps so
 * tests can exercise the full lifecycle without needing a real database.
 */
export class InMemoryCharacterRepository implements CharacterRepository {
	private users = new Map<number, User>()
	private usersByLicense = new Map<string, User>()
	private characters = new Map<number, Character>()
	private nextUserId = 1
	private nextCharId = 1

	async findUserByLicense(license: string): Promise<User | null> {
		return this.usersByLicense.get(license) ?? null
	}

	async createUser(input: {
		license: string
		discord?: string | null
		steam?: string | null
	}): Promise<User> {
		const user: User = {
			id: this.nextUserId++,
			license: input.license,
			discord: input.discord ?? null,
			steam: input.steam ?? null,
			lastSeen: new Date(),
			banned: false,
		}
		this.users.set(user.id, user)
		this.usersByLicense.set(user.license, user)
		return user
	}

	async touchUser(userId: number): Promise<void> {
		const user = this.users.get(userId)
		if (user) user.lastSeen = new Date()
	}

	async findCharactersByUser(userId: number): Promise<Character[]> {
		return Array.from(this.characters.values()).filter((c) => c.userId === userId)
	}

	async findCharacterById(charId: number): Promise<Character | null> {
		return this.characters.get(charId) ?? null
	}

	async createCharacter(input: CreateCharacterInput): Promise<Character> {
		const character: Character = {
			id: this.nextCharId++,
			userId: input.userId,
			slot: input.slot,
			firstName: input.firstName,
			lastName: input.lastName,
			dateOfBirth: input.dateOfBirth,
			gender: input.gender,
			cash: 0,
			bank: 500,
			job: 'unemployed',
			position: { x: -269.4, y: -955.3, z: 31.2 },
			appearance: {},
			metadata: {},
			createdAt: new Date(),
			lastPlayed: new Date(),
		}
		this.characters.set(character.id, character)
		return character
	}

	async saveCharacter(character: Character): Promise<void> {
		this.characters.set(character.id, { ...character, lastPlayed: new Date() })
	}

	async deleteCharacter(charId: number): Promise<void> {
		this.characters.delete(charId)
	}

	// --- Test helpers ---

	/** Insert a pre-built user (skip createUser flow) */
	seedUser(user: User): void {
		this.users.set(user.id, user)
		this.usersByLicense.set(user.license, user)
		if (user.id >= this.nextUserId) this.nextUserId = user.id + 1
	}

	/** Insert a pre-built character (skip createCharacter flow) */
	seedCharacter(character: Character): void {
		this.characters.set(character.id, character)
		if (character.id >= this.nextCharId) this.nextCharId = character.id + 1
	}

	/** Total user count (test introspection) */
	userCount(): number {
		return this.users.size
	}

	/** Total character count (test introspection) */
	characterCount(): number {
		return this.characters.size
	}
}
