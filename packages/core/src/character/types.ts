import type { Vec3 } from '@nextvm/natives'

/**
 * Character System Types.
 *   User = real person (license/discord/steam)
 *   Character = in-game identity (isolated state per character)
 */

/** User record — one per real person (Concept 9.1) */
export interface User {
	id: number
	license: string
	discord: string | null
	steam: string | null
	lastSeen: Date
	banned: boolean
}

/** Character record — many per user (Concept 9.3) */
export interface Character {
	id: number
	userId: number
	slot: number
	firstName: string
	lastName: string
	dateOfBirth: string
	gender: string
	cash: number
	bank: number
	job: string
	position: Vec3
	appearance: Record<string, unknown>
	metadata: Record<string, unknown>
	createdAt: Date
	lastPlayed: Date
}

/** Data needed to create a new character */
export interface CreateCharacterInput {
	userId: number
	slot: number
	firstName: string
	lastName: string
	dateOfBirth: string
	gender: string
}

/** Active player session — combines User + Character + connection info */
export interface PlayerSession {
	source: number
	user: User
	character: Character | null
}

/**
 * Character lifecycle states (Concept 9.2):
 *   1. connecting — player connecting, user record loading
 *   2. selecting — user loaded, character selection screen
 *   3. active — character selected, playing
 *   4. switching — switching character (save old, load new)
 */
export type CharacterLifecycleState =
	| 'connecting'
	| 'selecting'
	| 'active'
	| 'switching'
