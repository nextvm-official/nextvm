/**
 * Read FiveM player identifiers (license, discord, steam) for a source.
 *
 * Pulled out so tests can stub the global natives in isolation.
 */
export interface PlayerIdentifiers {
	license: string | null
	discord: string | null
	steam: string | null
}

declare function GetNumPlayerIdentifiers(source: string): number
declare function GetPlayerIdentifier(source: string, index: number): string | undefined

export function readPlayerIdentifiers(source: number): PlayerIdentifiers {
	const result: PlayerIdentifiers = { license: null, discord: null, steam: null }
	if (typeof GetNumPlayerIdentifiers !== 'function') return result
	const count = GetNumPlayerIdentifiers(String(source))
	for (let i = 0; i < count; i++) {
		const id = GetPlayerIdentifier(String(source), i)
		if (!id) continue
		const [prefix, ...rest] = id.split(':')
		const value = rest.join(':')
		if (prefix === 'license' && !result.license) result.license = `license:${value}`
		else if (prefix === 'discord' && !result.discord) result.discord = `discord:${value}`
		else if (prefix === 'steam' && !result.steam) result.steam = `steam:${value}`
	}
	return result
}
