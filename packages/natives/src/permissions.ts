import type { PlayerSource } from './types'

/**
 * Permissions — Low-level wrappers around FiveM ACE/ACL natives.
 *
 * Concept v2.3, Chapter 20.3:
 *   "FiveM has a built-in permission system called ACE (Access Control
 *   Entries) with Principals (identifiers/groups) and hierarchical
 *   inheritance. NextVM's RBAC must not exist parallel to ACE — it must
 *   sit on top of it."
 *
 * This is the LAYER 2 wrapper. The high-level PermissionsService lives
 * in @nextvm/core (Layer 3) and uses these primitives.
 */
export class Permissions {
	private constructor() {}

	/** Check if a player is allowed to perform an ACE-controlled action */
	static isAllowed(source: PlayerSource, ace: string): boolean {
		return IsPlayerAceAllowed(String(source), ace)
	}

	/** Add an ACE entry: `add_ace <principal> <object> allow|deny` */
	static addAce(principal: string, object: string, allow: boolean): void {
		ExecuteCommand(`add_ace ${principal} ${object} ${allow ? 'allow' : 'deny'}`)
	}

	/** Remove an ACE entry */
	static removeAce(principal: string, object: string, allow: boolean): void {
		ExecuteCommand(`remove_ace ${principal} ${object} ${allow ? 'allow' : 'deny'}`)
	}

	/** Add a principal: `add_principal <child> <parent>` */
	static addPrincipal(child: string, parent: string): void {
		ExecuteCommand(`add_principal ${child} ${parent}`)
	}

	/** Remove a principal */
	static removePrincipal(child: string, parent: string): void {
		ExecuteCommand(`remove_principal ${child} ${parent}`)
	}

	/**
	 * Get a player's license identifier as an ACE principal string.
	 * Returns null if no license identifier is found.
	 */
	static getLicensePrincipal(source: PlayerSource): string | null {
		const count = GetNumPlayerIdentifiers(String(source))
		for (let i = 0; i < count; i++) {
			const id = GetPlayerIdentifier(String(source), i)
			if (id?.startsWith('license:')) {
				return `identifier.${id}`
			}
		}
		return null
	}
}
