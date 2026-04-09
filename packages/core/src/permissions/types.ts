/**
 * Permissions Types.
 *
 * Concept v2.3, Chapter 20.3.
 *
 * NextVM RBAC sits on top of FiveM ACE. All NextVM ACE entries are
 * prefixed with `nextvm.` to avoid collisions with other resources.
 */

/** A NextVM permission name (without the nextvm. prefix) */
export type Permission = string

/** A NextVM role name (without the group.nextv_ prefix) */
export type Role = string

/** Definition of a permission and its optional parent (for inheritance) */
export interface PermissionDefinition {
	name: Permission
	description?: string
	parent?: Permission
}
