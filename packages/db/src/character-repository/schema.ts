import { column } from '../column'
import { defineTable } from '../define-table'

/**
 * NextVM core character system tables.
 *
 * Concept v2.3, Chapter 9.3.
 *
 * These tables back the CharacterRepository implementation.
 * Migrations to create them are provided alongside.
 */

export const usersTable = defineTable('nextv_users', {
	id: column.int().primaryKey().autoIncrement(),
	license: column.string(50).unique(),
	discord: column.string(30).nullable(),
	steam: column.string(30).nullable(),
	lastSeen: column.timestamp().defaultNow(),
	banned: column.boolean().default(false),
})

export const charactersTable = defineTable('nextv_characters', {
	id: column.int().primaryKey().autoIncrement(),
	userId: column.int().references('nextv_users.id'),
	slot: column.int(),
	firstName: column.string(50),
	lastName: column.string(50),
	dateOfBirth: column.string(10),
	gender: column.string(10),
	cash: column.int().default(0),
	bank: column.int().default(500),
	job: column.string(50).default('unemployed'),
	position: column.json<{ x: number; y: number; z: number }>().default({
		x: -269.4,
		y: -955.3,
		z: 31.2,
	}),
	appearance: column.json().default({}),
	metadata: column.json().default({}),
	createdAt: column.timestamp().defaultNow(),
	lastPlayed: column.timestamp().defaultNow(),
})
