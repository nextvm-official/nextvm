import type { CompatCharacterSnapshot, CompatDataSource, ExportsApi } from './types'

/**
 * QBCore compatibility mapper.
 *   exports['qb-core'] = { GetCoreObject: () => ({ Functions: { GetPlayer } }) }
 * Maps a NextVM character snapshot into the QBCore Player format that
 * existing qb-* scripts expect. Covers the 80% most-used APIs.
 */

export interface QbCharInfo {
	firstname: string
	lastname: string
	birthdate: string
	gender: number
	nationality: string
	cid: number
}

export interface QbMoney {
	cash: number
	bank: number
	crypto: number
}

export interface QbJob {
	name: string
	label: string
	grade: { level: number; name: string }
	type: string
	onduty: boolean
}

export interface QbItem {
	name: string
	label: string
	amount: number
	weight: number
	slot: number
	info: Record<string, unknown>
}

export interface QbPlayerData {
	source: number
	citizenid: string
	license: string
	charinfo: QbCharInfo
	money: QbMoney
	job: QbJob
	metadata: Record<string, unknown>
	items: QbItem[]
	position: { x: number; y: number; z: number }
}

export interface QbPlayer {
	PlayerData: QbPlayerData
	Functions: {
		GetMoney(type: keyof QbMoney): number
		AddMoney(type: keyof QbMoney, amount: number, reason?: string): boolean
		RemoveMoney(type: keyof QbMoney, amount: number, reason?: string): boolean
		GetName(): string
		GetCoords(): { x: number; y: number; z: number }
	}
}

/** Build a QBCore-style Player from a NextVM character snapshot */
export function toQbPlayer(snap: CompatCharacterSnapshot): QbPlayer {
	const playerData: QbPlayerData = {
		source: snap.source,
		citizenid: snap.identifiers.license ?? `NEXTV${snap.charId}`,
		license: snap.identifiers.license ?? '',
		charinfo: {
			firstname: snap.firstName,
			lastname: snap.lastName,
			birthdate: '1990-01-01',
			gender: 0,
			nationality: 'Unknown',
			cid: snap.charId,
		},
		money: {
			cash: snap.cash,
			bank: snap.bank,
			crypto: 0,
		},
		job: {
			name: snap.job,
			label: snap.job,
			grade: { level: snap.jobGrade, name: `Grade ${snap.jobGrade}` },
			type: 'none',
			onduty: false,
		},
		metadata: {},
		items: snap.inventory.map((it, idx) => ({
			name: it.name,
			label: it.label,
			amount: it.count,
			weight: it.weight,
			slot: idx + 1,
			info: {},
		})),
		position: { ...snap.position },
	}

	return {
		PlayerData: playerData,
		Functions: {
			GetMoney: (type) => playerData.money[type] ?? 0,
			AddMoney: (type, amount) => {
				if (amount <= 0) return false
				playerData.money[type] = (playerData.money[type] ?? 0) + amount
				return true
			},
			RemoveMoney: (type, amount) => {
				if (amount <= 0) return false
				if ((playerData.money[type] ?? 0) < amount) return false
				playerData.money[type] -= amount
				return true
			},
			GetName: () => `${playerData.charinfo.firstname} ${playerData.charinfo.lastname}`,
			GetCoords: () => ({ ...playerData.position }),
		},
	}
}

/**
 * Register the `qb-core` exports.
 * After this runs, any legacy QBCore script can call:
 *   local QBCore = exports['qb-core']:GetCoreObject()
 *   local Player = QBCore.Functions.GetPlayer(source)
 */
export function registerQbExports(exportsApi: ExportsApi, source: CompatDataSource): void {
	const buildCore = () => ({
		Functions: {
			GetPlayer: (src: number) => {
				const snap = source.getCharacter(src)
				return snap ? toQbPlayer(snap) : null
			},
			GetPlayers: () => source.getActiveSources(),
			GetPlayerByCitizenId: (citizenid: string) => {
				for (const src of source.getActiveSources()) {
					const snap = source.getCharacter(src)
					if (snap && (snap.identifiers.license ?? `NEXTV${snap.charId}`) === citizenid) {
						return toQbPlayer(snap)
					}
				}
				return null
			},
		},
	})

	exportsApi.register('qb-core', 'GetCoreObject', () => buildCore())
}
