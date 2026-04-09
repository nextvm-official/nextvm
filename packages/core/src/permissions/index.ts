/**
 * @nextvm/core/permissions — RBAC on top of FiveM ACE
 *
 * Concept v2.3, Chapter 20.3.
 *
 * Usage:
 *   import { PermissionsService } from '@nextvm/core'
 *
 *   const perms = new PermissionsService()
 *   perms.definePermission('banking.admin.setBalance', { description: '...' })
 *   perms.defineRole('admin')
 *   perms.grantPermissionToRole('admin', 'banking.admin.setBalance')
 *   perms.grantRole(source, 'admin')
 *
 *   if (perms.hasPermission(source, 'banking.admin.setBalance')) { ... }
 *
 * RPC integration:
 *   procedure
 *     .input(...)
 *     .auth((ctx) => perms.hasPermission(ctx.source, 'banking.admin.setBalance'))
 *     .mutation(...)
 */

export { PermissionsService } from './permissions-service'
export type { Permission, Role, PermissionDefinition } from './types'
