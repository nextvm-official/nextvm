import type {
	Character,
	CharacterRepository,
	CreateCharacterInput,
	User,
} from '@nextvm/core'

/**
 * Tiny in-memory CharacterRepository fallback used when no real
 * repository is supplied to `bootstrapServer`. Lets a NextVM resource
 * boot and accept connections without a database — handy for smoke
 * tests, demos, and "first run" experiences.
 *
 * Production deployments should pass a `DbCharacterRepository` from
 * `@nextvm/db` instead.
 */
export class InMemoryRuntimeCharacterRepository implements CharacterRepository {
	private users = new Map<string, User>()
	private characters = new Map<number, Character>()
	private nextUserId = 1
	private nextCharId = 1

	async findUserByLicense(license: string): Promise<User | null> {
		return this.users.get(license) ?? null
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
		this.users.set(input.license, user)
		return user
	}

	async touchUser(userId: number): Promise<void> {
		for (const user of this.users.values()) {
			if (user.id === userId) {
				user.lastSeen = new Date()
				return
			}
		}
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
			position: { x: 0, y: 0, z: 0 },
			appearance: {},
			metadata: {},
			createdAt: new Date(),
			lastPlayed: new Date(),
		}
		this.characters.set(character.id, character)
		return character
	}

	async saveCharacter(character: Character): Promise<void> {
		this.characters.set(character.id, character)
	}

	async deleteCharacter(charId: number): Promise<void> {
		this.characters.delete(charId)
	}
}
