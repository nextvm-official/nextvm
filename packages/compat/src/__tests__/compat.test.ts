import { describe, expect, it } from 'vitest'
import { InMemoryExportsApi } from '../exports-api'
import { registerEsxExports, toEsxPlayer } from '../esx-mapper'
import { registerQbExports, toQbPlayer } from '../qbcore-mapper'
import { setupCompat } from '../setup'
import type { CompatCharacterSnapshot, CompatDataSource } from '../types'

function makeSnap(overrides: Partial<CompatCharacterSnapshot> = {}): CompatCharacterSnapshot {
	return {
		source: 5,
		charId: 42,
		identifiers: { license: 'license:abc', discord: null, steam: null },
		firstName: 'Jane',
		lastName: 'Doe',
		cash: 1500,
		bank: 25_000,
		job: 'police',
		jobGrade: 3,
		position: { x: 1, y: 2, z: 3 },
		inventory: [
			{ name: 'water', label: 'Water Bottle', count: 2, weight: 100 },
			{ name: 'bread', label: 'Bread', count: 1, weight: 200 },
		],
		...overrides,
	}
}

function makeSource(snaps: CompatCharacterSnapshot[]): CompatDataSource {
	const bySource = new Map(snaps.map((s) => [s.source, s]))
	return {
		getCharacter: (src) => bySource.get(src) ?? null,
		getActiveSources: () => [...bySource.keys()],
	}
}

describe('InMemoryExportsApi', () => {
	it('registers and calls exports', () => {
		const api = new InMemoryExportsApi()
		api.register('es_extended', 'getSharedObject', () => ({ ok: true }))
		expect(api.call('es_extended', 'getSharedObject')).toEqual({ ok: true })
	})

	it('throws on unknown export', () => {
		const api = new InMemoryExportsApi()
		expect(() => api.call('nope', 'fn')).toThrow(/not registered/)
	})

	it('lists registered resources', () => {
		const api = new InMemoryExportsApi()
		api.register('a', 'x', () => null)
		api.register('b', 'y', () => null)
		expect(api.getResources().sort()).toEqual(['a', 'b'])
	})
})

describe('toEsxPlayer', () => {
	it('maps the core fields', () => {
		const p = toEsxPlayer(makeSnap())
		expect(p.source).toBe(5)
		expect(p.identifier).toBe('license:abc')
		expect(p.getName()).toBe('Jane Doe')
		expect(p.getMoney()).toBe(1500)
		expect(p.getIdentifier()).toBe('license:abc')
	})

	it('exposes the three accounts', () => {
		const p = toEsxPlayer(makeSnap())
		expect(p.getAccount('money').money).toBe(1500)
		expect(p.getAccount('bank').money).toBe(25_000)
		expect(p.getAccount('black_money').money).toBe(0)
	})

	it('maps job + grade', () => {
		const p = toEsxPlayer(makeSnap())
		const job = p.getJob()
		expect(job.name).toBe('police')
		expect(job.grade).toBe(3)
		expect(job.grade_name).toBe('grade3')
	})

	it('maps inventory and finds items', () => {
		const p = toEsxPlayer(makeSnap())
		expect(p.inventory).toHaveLength(2)
		expect(p.getInventoryItem('water')?.count).toBe(2)
		expect(p.getInventoryItem('missing')).toBeNull()
	})

	it('falls back to nextv:<charId> when no license', () => {
		const p = toEsxPlayer(
			makeSnap({ identifiers: { license: null, discord: null, steam: null } }),
		)
		expect(p.identifier).toBe('nextv:42')
	})
})

describe('registerEsxExports', () => {
	it('exposes GetPlayerFromId via the shared object', () => {
		const api = new InMemoryExportsApi()
		const source = makeSource([makeSnap()])
		registerEsxExports(api, source)
		const shared = api.call('es_extended', 'getSharedObject') as {
			GetPlayerFromId: (s: number) => ReturnType<typeof toEsxPlayer> | null
		}
		expect(shared.GetPlayerFromId(5)?.getName()).toBe('Jane Doe')
		expect(shared.GetPlayerFromId(999)).toBeNull()
	})

	it('GetPlayerFromIdentifier looks up by license', () => {
		const api = new InMemoryExportsApi()
		const source = makeSource([makeSnap()])
		registerEsxExports(api, source)
		const shared = api.call('es_extended', 'getSharedObject') as {
			GetPlayerFromIdentifier: (id: string) => ReturnType<typeof toEsxPlayer> | null
		}
		expect(shared.GetPlayerFromIdentifier('license:abc')?.source).toBe(5)
		expect(shared.GetPlayerFromIdentifier('license:nope')).toBeNull()
	})
})

describe('toQbPlayer', () => {
	it('maps PlayerData fields', () => {
		const p = toQbPlayer(makeSnap())
		expect(p.PlayerData.source).toBe(5)
		expect(p.PlayerData.citizenid).toBe('license:abc')
		expect(p.PlayerData.charinfo.firstname).toBe('Jane')
		expect(p.PlayerData.charinfo.cid).toBe(42)
		expect(p.PlayerData.money.cash).toBe(1500)
		expect(p.PlayerData.money.bank).toBe(25_000)
		expect(p.PlayerData.job.grade.level).toBe(3)
		expect(p.PlayerData.items).toHaveLength(2)
		expect(p.PlayerData.items[0].slot).toBe(1)
	})

	it('AddMoney adds cash', () => {
		const p = toQbPlayer(makeSnap())
		expect(p.Functions.AddMoney('cash', 500)).toBe(true)
		expect(p.Functions.GetMoney('cash')).toBe(2000)
	})

	it('AddMoney rejects non-positive', () => {
		const p = toQbPlayer(makeSnap())
		expect(p.Functions.AddMoney('cash', 0)).toBe(false)
		expect(p.Functions.AddMoney('cash', -10)).toBe(false)
		expect(p.Functions.GetMoney('cash')).toBe(1500)
	})

	it('RemoveMoney rejects overdraw', () => {
		const p = toQbPlayer(makeSnap())
		expect(p.Functions.RemoveMoney('cash', 99_999)).toBe(false)
		expect(p.Functions.GetMoney('cash')).toBe(1500)
	})

	it('RemoveMoney succeeds within balance', () => {
		const p = toQbPlayer(makeSnap())
		expect(p.Functions.RemoveMoney('bank', 5000)).toBe(true)
		expect(p.Functions.GetMoney('bank')).toBe(20_000)
	})

	it('GetName concatenates first + last', () => {
		const p = toQbPlayer(makeSnap())
		expect(p.Functions.GetName()).toBe('Jane Doe')
	})

	it('falls back to NEXTV<charId> for citizenid when no license', () => {
		const p = toQbPlayer(
			makeSnap({ identifiers: { license: null, discord: null, steam: null } }),
		)
		expect(p.PlayerData.citizenid).toBe('NEXTV42')
	})
})

describe('registerQbExports', () => {
	it('exposes GetPlayer via core object', () => {
		const api = new InMemoryExportsApi()
		const source = makeSource([makeSnap()])
		registerQbExports(api, source)
		const core = api.call('qb-core', 'GetCoreObject') as {
			Functions: { GetPlayer: (s: number) => ReturnType<typeof toQbPlayer> | null }
		}
		expect(core.Functions.GetPlayer(5)?.PlayerData.charinfo.firstname).toBe('Jane')
		expect(core.Functions.GetPlayer(999)).toBeNull()
	})

	it('GetPlayerByCitizenId resolves by license', () => {
		const api = new InMemoryExportsApi()
		const source = makeSource([makeSnap()])
		registerQbExports(api, source)
		const core = api.call('qb-core', 'GetCoreObject') as {
			Functions: { GetPlayerByCitizenId: (id: string) => ReturnType<typeof toQbPlayer> | null }
		}
		expect(core.Functions.GetPlayerByCitizenId('license:abc')?.PlayerData.source).toBe(5)
		expect(core.Functions.GetPlayerByCitizenId('license:nope')).toBeNull()
	})
})

describe('setupCompat', () => {
	it('registers both ESX and QBCore by default', () => {
		const api = new InMemoryExportsApi()
		setupCompat({ dataSource: makeSource([makeSnap()]), exportsApi: api })
		expect(api.getResources().sort()).toEqual(['es_extended', 'qb-core'])
	})

	it('respects enable flags', () => {
		const api = new InMemoryExportsApi()
		setupCompat({
			dataSource: makeSource([makeSnap()]),
			exportsApi: api,
			enable: { esx: true, qbcore: false },
		})
		expect(api.getResources()).toEqual(['es_extended'])
	})

	it('can disable both', () => {
		const api = new InMemoryExportsApi()
		setupCompat({
			dataSource: makeSource([makeSnap()]),
			exportsApi: api,
			enable: { esx: false, qbcore: false },
		})
		expect(api.getResources()).toEqual([])
	})
})
