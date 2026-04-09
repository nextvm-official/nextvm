import { Permissions } from '@nextvm/natives'
import { createLogger } from '../logger/logger'
import type { Permission, PermissionDefinition, Role } from './types'

/**
 * PermissionsService — High-level RBAC built on top of FiveM ACE.
 *
 * Concept v2.3, Chapter 20.3:
 *   - Wraps ACE: grantRole/revokeRole map to add_principal/remove_principal
 *   - Permission checks delegate to IsPlayerAceAllowed
 *   - All ACE entries prefixed with `nextvm.` to avoid collisions
 *   - Existing server.cfg ACE groups are preserved (no overrides)
 *   - txAdmin, vMenu, etc. can see and manage NextVM permissions natively
 *
 * GUARD-006 compliant: instance state, no globals.
 *
 * Usage:
 *   const perms = new PermissionsService()
 *   perms.definePermission('banking.admin.setBalance')
 *   perms.grantRole(source, 'admin')
 *   if (perms.hasPermission(source, 'banking.admin.setBalance')) { ... }
 */
export class PermissionsService {
	private definedPermissions = new Map<Permission, PermissionDefinition>()
	private definedRoles = new Set<Role>()
	private log = createLogger('nextvm:permissions')

	/** Prefix all NextVM ACE entries with this namespace */
	private readonly acePrefix = 'nextvm'
	private readonly groupPrefix = 'nextv_'

	/**
	 * Check if a player has a specific permission.
	 * Delegates to FiveM ACE.
	 */
	hasPermission(source: number, permission: Permission): boolean {
		const ace = this.toAce(permission)
		return Permissions.isAllowed(source, ace)
	}

	/**
	 * Define a permission. Idempotent.
	 * Concept v2.3:
	 *   "Module-defined permissions register as ACE entries"
	 */
	definePermission(name: Permission, options?: { description?: string; parent?: Permission }): void {
		if (this.definedPermissions.has(name)) return
		this.definedPermissions.set(name, {
			name,
			description: options?.description,
			parent: options?.parent,
		})
	}

	/**
	 * Define a role. Roles are mapped to FiveM ACE groups.
	 * Idempotent.
	 */
	defineRole(name: Role): void {
		if (this.definedRoles.has(name)) return
		this.definedRoles.add(name)
	}

	/**
	 * Grant a permission to a role.
	 * Wraps: add_ace group.nextv_<role> nextvm.<permission> allow
	 */
	grantPermissionToRole(role: Role, permission: Permission): void {
		this.defineRole(role)
		this.definePermission(permission)
		Permissions.addAce(this.toGroup(role), this.toAce(permission), true)
		this.log.debug('Granted permission to role', { role, permission })
	}

	/**
	 * Revoke a permission from a role.
	 */
	revokePermissionFromRole(role: Role, permission: Permission): void {
		Permissions.removeAce(this.toGroup(role), this.toAce(permission), true)
		this.log.debug('Revoked permission from role', { role, permission })
	}

	/**
	 * Grant a role to a player.
	 * Concept v2.3:
	 *   nextvm.permissions.grantRole(source, 'admin')
	 *   → ExecuteCommand('add_principal identifier.license:xxx group.nextv_admin')
	 */
	grantRole(source: number, role: Role): boolean {
		const principal = this.getPlayerPrincipal(source)
		if (!principal) {
			this.log.warn('Cannot grant role: no license identifier', { source, role })
			return false
		}
		this.defineRole(role)
		Permissions.addPrincipal(principal, this.toGroup(role))
		this.log.info('Role granted', { source, role })
		return true
	}

	/**
	 * Revoke a role from a player.
	 */
	revokeRole(source: number, role: Role): boolean {
		const principal = this.getPlayerPrincipal(source)
		if (!principal) return false
		Permissions.removePrincipal(principal, this.toGroup(role))
		this.log.info('Role revoked', { source, role })
		return true
	}

	/** Get all defined permissions (for introspection / dashboard) */
	getDefinedPermissions(): PermissionDefinition[] {
		return Array.from(this.definedPermissions.values())
	}

	/** Get all defined roles */
	getDefinedRoles(): Role[] {
		return Array.from(this.definedRoles)
	}

	/** Convert a NextVM permission to its ACE form (with prefix) */
	private toAce(permission: Permission): string {
		return `${this.acePrefix}.${permission}`
	}

	/** Convert a NextVM role to its ACE group form */
	private toGroup(role: Role): string {
		return `group.${this.groupPrefix}${role}`
	}

	/**
	 * Get a player's primary principal (license identifier) for ACE.
	 * Delegated to the natives layer (GUARD-001).
	 */
	private getPlayerPrincipal(source: number): string | null {
		return Permissions.getLicensePrincipal(source)
	}
}
