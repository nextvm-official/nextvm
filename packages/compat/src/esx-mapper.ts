import type { CompatCharacterSnapshot, CompatDataSource, ExportsApi } from './types'

/**
 * ESX compatibility mapper.
 *
 * Concept v2.3, Chapter 16.1:
 *   exports['es_extended'] = { getSharedObject: () => ({ ... }) }
 *
 * Maps a NextVM character snapshot into the xPlayer format that
 * existing ESX scripts (esx_*) expect. Covers the 80% most-used APIs.
 */

export interface EsxAccount {
	name: 'money' | 'bank' | 'black_money'
	label: string
	money: number
}

export interface EsxJob {
	name: string
	label: string
	grade: number
	grade_label: string
	grade_name: string
	grade_salary: number
	skin_male: Record<string, unknown>
	skin_female: Record<string, unknown>
}

export interface EsxItem {
	name: string
	label: string
	count: number
	weight: number
	type?: string
	usable?: boolean
	canRemove?: boolean
}

export interface EsxPlayer {
	source: number
	identifier: string
	accounts: EsxAccount[]
	job: EsxJob
	inventory: EsxItem[]
	getName(): string
	getMoney(): number
	getAccount(name: 'money' | 'bank' | 'black_money'): EsxAccount
	getJob(): EsxJob
	getInventoryItem(name: string): EsxItem | null
	getCoords(vector?: boolean): { x: number; y: number; z: number }
	getIdentifier(): string
}

/** Build an ESX-style xPlayer from a NextVM character snapshot */
export function toEsxPlayer(snap: CompatCharacterSnapshot): EsxPlayer {
	const accounts: EsxAccount[] = [
		{ name: 'money', label: 'Cash', money: snap.cash },
		{ name: 'bank', label: 'Bank', money: snap.bank },
		{ name: 'black_money', label: 'Black Money', money: 0 },
	]

	const job: EsxJob = {
		name: snap.job,
		label: snap.job,
		grade: snap.jobGrade,
		grade_label: `Grade ${snap.jobGrade}`,
		grade_name: `grade${snap.jobGrade}`,
		grade_salary: 0,
		skin_male: {},
		skin_female: {},
	}

	const inventory: EsxItem[] = snap.inventory.map((it) => ({
		name: it.name,
		label: it.label,
		count: it.count,
		weight: it.weight,
		type: 'item_standard',
		usable: true,
		canRemove: true,
	}))

	return {
		source: snap.source,
		identifier: snap.identifiers.license ?? `nextv:${snap.charId}`,
		accounts,
		job,
		inventory,
		getName: () => `${snap.firstName} ${snap.lastName}`,
		getMoney: () => snap.cash,
		getAccount: (name) =>
			accounts.find((a) => a.name === name) ?? { name, label: name, money: 0 },
		getJob: () => job,
		getInventoryItem: (name: string) => inventory.find((i) => i.name === name) ?? null,
		getCoords: () => ({ ...snap.position }),
		getIdentifier: () => snap.identifiers.license ?? `nextv:${snap.charId}`,
	}
}

/**
 * Register the `es_extended` exports.
 *
 * After this runs, any legacy ESX script can call:
 *   local ESX = exports['es_extended']:getSharedObject()
 *   local xPlayer = ESX.GetPlayerFromId(source)
 */
export function registerEsxExports(exportsApi: ExportsApi, source: CompatDataSource): void {
	const buildShared = () => ({
		GetPlayerFromId: (src: number) => {
			const snap = source.getCharacter(src)
			return snap ? toEsxPlayer(snap) : null
		},
		GetPlayers: () => source.getActiveSources(),
		GetPlayerFromIdentifier: (identifier: string) => {
			for (const src of source.getActiveSources()) {
				const snap = source.getCharacter(src)
				if (snap?.identifiers.license === identifier) return toEsxPlayer(snap)
			}
			return null
		},
	})

	exportsApi.register('es_extended', 'getSharedObject', () => buildShared())
}
