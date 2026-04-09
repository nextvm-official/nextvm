import type { CharacterRepository } from './character-repository'
import type {
	Character,
	CharacterLifecycleState,
	CreateCharacterInput,
	PlayerSession,
	User,
} from './types'

/**
 * CharacterService — Manages User/Character lifecycle.
 *   - User/Character separation (ADR-004)
 *   - Multi-character support (configurable limit, default 5)
 *   - Character selection via routing buckets
 *   - All game state attached to Character, not User
 * Note: This service provides the in-memory session management.
 * Actual DB persistence will be added when the DB layer is implemented.
 * For now, it defines the contract and manages runtime sessions.
 */
export class CharacterService {
	private sessions = new Map<number, PlayerSession>()
	private lifecycleStates = new Map<number, CharacterLifecycleState>()
	private maxCharacters: number
	private repository: CharacterRepository | null

	constructor(opts?: { maxCharacters?: number; repository?: CharacterRepository }) {
		this.maxCharacters = opts?.maxCharacters ?? 5
		this.repository = opts?.repository ?? null
	}

	/** Set or replace the repository (e.g., after deferred DB initialization) */
	setRepository(repository: CharacterRepository): void {
		this.repository = repository
	}

	/** Throw if no repository is set — used by persistence methods */
	private requireRepo(): CharacterRepository {
		if (!this.repository) {
			throw new Error(
				'CharacterService has no repository configured. Set one via setRepository() or constructor opts.',
			)
		}
		return this.repository
	}

	// --- Persistence helpers (require repository) ---

	/**
	 * Step 1 (DB): Load or create a User record from license + identifiers.
	 * Then create the in-memory session.
	 */
	async loadOrCreateUser(input: {
		source: number
		license: string
		discord?: string | null
		steam?: string | null
	}): Promise<PlayerSession> {
		const repo = this.requireRepo()
		let user = await repo.findUserByLicense(input.license)
		if (!user) {
			user = await repo.createUser({
				license: input.license,
				discord: input.discord ?? null,
				steam: input.steam ?? null,
			})
		} else {
			await repo.touchUser(user.id)
		}
		return this.createSession(input.source, user)
	}

	/** Get all characters for the player's user (from DB) */
	async loadCharactersForUser(source: number): Promise<Character[]> {
		const repo = this.requireRepo()
		const session = this.sessions.get(source)
		if (!session) throw new Error(`No session for source ${source}`)
		return repo.findCharactersByUser(session.user.id)
	}

	/** Create a new character in DB and return it */
	async createCharacterInDb(input: CreateCharacterInput): Promise<Character> {
		const repo = this.requireRepo()
		return repo.createCharacter(input)
	}

	/** Load a character from DB by ID and attach to the session */
	async loadAndSelectCharacter(source: number, charId: number): Promise<PlayerSession> {
		const repo = this.requireRepo()
		const character = await repo.findCharacterById(charId)
		if (!character) {
			throw new Error(`Character ${charId} not found`)
		}
		return this.selectCharacter(source, character)
	}

	/** Persist the current character of a session */
	async saveCurrentCharacter(source: number): Promise<void> {
		const repo = this.requireRepo()
		const session = this.sessions.get(source)
		if (!session?.character) return
		await repo.saveCharacter(session.character)
	}

	/** Save and remove the session (e.g., on disconnect) */
	async saveAndRemoveSession(source: number): Promise<void> {
		await this.saveCurrentCharacter(source).catch(() => {
			// Save failed — still remove session, log via caller
		})
		this.removeSession(source)
	}

	/**
	 * Step 1 of lifecycle (Concept 9.2):
	 * Player connects → Create session with User, no character yet.
	 */
	createSession(source: number, user: User): PlayerSession {
		const session: PlayerSession = {
			source,
			user,
			character: null,
		}
		this.sessions.set(source, session)
		this.lifecycleStates.set(source, 'connecting')
		return session
	}

	/**
	 * Step 2: Player enters character selection.
	 * Should be called after routing to character-select bucket.
	 */
	enterCharacterSelection(source: number): void {
		this.lifecycleStates.set(source, 'selecting')
	}

	/**
	 * Step 3: Character selected/created → Attach to session.
	 * Returns the full session with active character.
	 */
	selectCharacter(source: number, character: Character): PlayerSession {
		const session = this.sessions.get(source)
		if (!session) {
			throw new Error(`No session for source ${source}`)
		}

		session.character = character
		this.lifecycleStates.set(source, 'active')
		return session
	}

	/**
	 * Step 6: Character switch (without disconnect).
	 * Concept 9.2: "Current character saved, new character loaded,
	 * all modules notified via onCharacterSwitch hook."
	 */
	switchCharacter(
		source: number,
		newCharacter: Character,
	): { oldCharId: number; newCharId: number } {
		const session = this.sessions.get(source)
		if (!session?.character) {
			throw new Error(`No active character for source ${source}`)
		}

		const oldCharId = session.character.id
		this.lifecycleStates.set(source, 'switching')

		session.character = newCharacter
		this.lifecycleStates.set(source, 'active')

		return { oldCharId, newCharId: newCharacter.id }
	}

	/**
	 * Step 5: Player disconnects → Clear session.
	 * Character data should be persisted to DB before calling this.
	 */
	removeSession(source: number): PlayerSession | undefined {
		const session = this.sessions.get(source)
		this.sessions.delete(source)
		this.lifecycleStates.delete(source)
		return session
	}

	/** Get a player's current session */
	getSession(source: number): PlayerSession | undefined {
		return this.sessions.get(source)
	}

	/** Get a player's active character */
	getCharacter(source: number): Character | null {
		return this.sessions.get(source)?.character ?? null
	}

	/** Get the character ID for a source */
	getCharacterId(source: number): number | null {
		return this.sessions.get(source)?.character?.id ?? null
	}

	/** Get a player's User record */
	getUser(source: number): User | undefined {
		return this.sessions.get(source)?.user
	}

	/** Get all active sessions */
	getAllSessions(): PlayerSession[] {
		return Array.from(this.sessions.values())
	}

	/** Get all sessions with active characters */
	getActivePlayers(): PlayerSession[] {
		return this.getAllSessions().filter((s) => s.character !== null)
	}

	/** Get the lifecycle state of a player */
	getLifecycleState(source: number): CharacterLifecycleState | undefined {
		return this.lifecycleStates.get(source)
	}

	/** Get the configured max characters per user */
	getMaxCharacters(): number {
		return this.maxCharacters
	}

	/** Validate that a user can create another character */
	canCreateCharacter(_userId: number, existingCount: number): boolean {
		return existingCount < this.maxCharacters
	}

	/**
	 * Build default character values for a new character.
	 * Concept 9.3: defaults from schema (cash=0, bank=500, job='unemployed', etc.)
	 */
	buildNewCharacter(input: CreateCharacterInput): Omit<Character, 'id' | 'createdAt' | 'lastPlayed'> {
		return {
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
		}
	}
}
