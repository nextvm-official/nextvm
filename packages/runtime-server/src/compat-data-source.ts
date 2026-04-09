import type { CharacterService } from '@nextvm/core'

/**
 * Compat data source backed by the live CharacterService.
 * Pulled into a dedicated module so `@nextvm/compat` can stay an
 * optional peer dependency: the type is structural and matches the
 * `CompatDataSource` interface from `@nextvm/compat` without importing
 * it.
 */
export interface RuntimeCompatCharacterSnapshot {
	source: number
	charId: number
	identifiers: { license: string | null; discord: string | null; steam: string | null }
	firstName: string
	lastName: string
	cash: number
	bank: number
	job: string
	jobGrade: number
	position: { x: number; y: number; z: number }
	inventory: Array<{ name: string; label: string; count: number; weight: number }>
}

export interface RuntimeCompatDataSource {
	getCharacter(source: number): RuntimeCompatCharacterSnapshot | null
	getActiveSources(): number[]
}

export function buildCompatDataSource(
	characters: CharacterService,
	identifierLookup: (source: number) => { license: string | null; discord: string | null; steam: string | null },
): RuntimeCompatDataSource {
	return {
		getCharacter(source) {
			const session = characters.getSession(source)
			if (!session?.character) return null
			const c = session.character
			return {
				source,
				charId: c.id,
				identifiers: identifierLookup(source),
				firstName: c.firstName,
				lastName: c.lastName,
				cash: c.cash,
				bank: c.bank,
				job: c.job,
				jobGrade: 0,
				position: c.position,
				inventory: [],
			}
		},
		getActiveSources() {
			return characters.getActivePlayers().map((s) => s.source)
		},
	}
}
