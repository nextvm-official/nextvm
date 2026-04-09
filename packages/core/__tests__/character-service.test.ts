import { describe, expect, it } from 'vitest'
import { InMemoryCharacterRepository } from '@nextvm/test-utils'
import { CharacterService } from '../src'

const buildService = () => {
	const repo = new InMemoryCharacterRepository()
	const service = new CharacterService({ repository: repo })
	return { service, repo }
}

describe('CharacterService', () => {
	it('creates a session for a freshly connected user', () => {
		const { service } = buildService()
		const session = service.createSession(1, {
			id: 1,
			license: 'license:abc',
			discord: null,
			steam: null,
			lastSeen: new Date(),
			banned: false,
		})
		expect(session.source).toBe(1)
		expect(session.character).toBeNull()
		expect(service.getLifecycleState(1)).toBe('connecting')
	})

	it('loadOrCreateUser inserts a new user when license is unknown', async () => {
		const { service, repo } = buildService()
		const session = await service.loadOrCreateUser({
			source: 1,
			license: 'license:abc',
		})
		expect(session.user.license).toBe('license:abc')
		expect(repo.userCount()).toBe(1)
	})

	it('loadOrCreateUser reuses existing user', async () => {
		const { service, repo } = buildService()
		await service.loadOrCreateUser({ source: 1, license: 'license:abc' })
		await service.loadOrCreateUser({ source: 2, license: 'license:abc' })
		expect(repo.userCount()).toBe(1)
	})

	it('selectCharacter attaches the character to the session and flips state', async () => {
		const { service, repo } = buildService()
		await service.loadOrCreateUser({ source: 1, license: 'license:abc' })
		const character = await service.createCharacterInDb({
			userId: 1,
			slot: 1,
			firstName: 'John',
			lastName: 'Doe',
			dateOfBirth: '1990-01-01',
			gender: 'male',
		})
		const session = service.selectCharacter(1, character)
		expect(session.character?.id).toBe(character.id)
		expect(service.getLifecycleState(1)).toBe('active')
		expect(service.getCharacterId(1)).toBe(character.id)
		expect(repo.characterCount()).toBe(1)
	})

	it('switchCharacter updates the active character and reports old/new ids', async () => {
		const { service } = buildService()
		await service.loadOrCreateUser({ source: 1, license: 'license:abc' })
		const c1 = await service.createCharacterInDb({
			userId: 1,
			slot: 1,
			firstName: 'A',
			lastName: 'A',
			dateOfBirth: '1990-01-01',
			gender: 'male',
		})
		const c2 = await service.createCharacterInDb({
			userId: 1,
			slot: 2,
			firstName: 'B',
			lastName: 'B',
			dateOfBirth: '1990-01-01',
			gender: 'female',
		})
		service.selectCharacter(1, c1)
		const result = service.switchCharacter(1, c2)
		expect(result.oldCharId).toBe(c1.id)
		expect(result.newCharId).toBe(c2.id)
		expect(service.getCharacterId(1)).toBe(c2.id)
	})

	it('saveCurrentCharacter persists the active character', async () => {
		const { service, repo } = buildService()
		await service.loadOrCreateUser({ source: 1, license: 'license:abc' })
		const character = await service.createCharacterInDb({
			userId: 1,
			slot: 1,
			firstName: 'John',
			lastName: 'Doe',
			dateOfBirth: '1990-01-01',
			gender: 'male',
		})
		service.selectCharacter(1, character)
		// Mutate
		const session = service.getSession(1)
		if (session?.character) session.character.cash = 1000
		await service.saveCurrentCharacter(1)
		const loaded = await repo.findCharacterById(character.id)
		expect(loaded?.cash).toBe(1000)
	})

	it('removeSession clears in-memory state', () => {
		const { service } = buildService()
		service.createSession(1, {
			id: 1,
			license: 'license:abc',
			discord: null,
			steam: null,
			lastSeen: new Date(),
			banned: false,
		})
		service.removeSession(1)
		expect(service.getSession(1)).toBeUndefined()
		expect(service.getLifecycleState(1)).toBeUndefined()
	})

	it('canCreateCharacter respects max', () => {
		const service = new CharacterService({ maxCharacters: 3 })
		expect(service.canCreateCharacter(1, 0)).toBe(true)
		expect(service.canCreateCharacter(1, 2)).toBe(true)
		expect(service.canCreateCharacter(1, 3)).toBe(false)
	})

	it('throws helpful error when no repository configured', async () => {
		const service = new CharacterService()
		await expect(
			service.loadOrCreateUser({ source: 1, license: 'l' }),
		).rejects.toThrow(/no repository configured/)
	})
})
