import type { Character, CreateCharacterInput, User } from './types'

/**
 * CharacterRepository — Persistence interface for User/Character data.
 *
 * Concept v2.3, Chapter 9.
 *
 * This is a PORT (interface) — the implementation lives in @nextvm/db
 * (or any other adapter). CharacterService depends on this interface,
 * NOT on @nextvm/db directly. This keeps Layer 3 (core) free of
 * Layer 3 cross-package coupling and allows alternative DB backends.
 *
 * Implementations:
 *   - DbCharacterRepository (uses @nextvm/db) — provided by the framework
 *   - InMemoryCharacterRepository — for tests, lives in @nextvm/test-utils
 */
export interface CharacterRepository {
	// --- Users ---

	/** Find a user by their license identifier */
	findUserByLicense(license: string): Promise<User | null>
	/** Create a new user record */
	createUser(input: { license: string; discord?: string | null; steam?: string | null }): Promise<User>
	/** Update lastSeen for a user */
	touchUser(userId: number): Promise<void>

	// --- Characters ---

	/** Get all characters belonging to a user */
	findCharactersByUser(userId: number): Promise<Character[]>
	/** Get a specific character by id */
	findCharacterById(charId: number): Promise<Character | null>
	/** Create a new character */
	createCharacter(input: CreateCharacterInput): Promise<Character>
	/** Persist changes to a character */
	saveCharacter(character: Character): Promise<void>
	/** Delete a character */
	deleteCharacter(charId: number): Promise<void>
}
