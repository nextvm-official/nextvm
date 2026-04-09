import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// We need to mock @nextvm/natives BEFORE importing PermissionsService.
// vi.hoisted lets us define the mock state up-front so the mock factory
// can read it without TDZ issues.
const naviveCalls = vi.hoisted(() => ({
	addAceCalls: [] as Array<[string, string, boolean]>,
	addPrincipalCalls: [] as Array<[string, string]>,
	removeAceCalls: [] as Array<[string, string, boolean]>,
	removePrincipalCalls: [] as Array<[string, string]>,
	allowedAces: new Set<string>(),
	playerLicense: 'identifier.license:abc' as string | null,
}))

vi.mock('@nextvm/natives', () => ({
	Permissions: {
		isAllowed: (source: number, ace: string) => naviveCalls.allowedAces.has(`${source}:${ace}`),
		addAce: (principal: string, object: string, allow: boolean) =>
			naviveCalls.addAceCalls.push([principal, object, allow]),
		removeAce: (principal: string, object: string, allow: boolean) =>
			naviveCalls.removeAceCalls.push([principal, object, allow]),
		addPrincipal: (child: string, parent: string) =>
			naviveCalls.addPrincipalCalls.push([child, parent]),
		removePrincipal: (child: string, parent: string) =>
			naviveCalls.removePrincipalCalls.push([child, parent]),
		getLicensePrincipal: (_source: number) => naviveCalls.playerLicense,
	},
}))

const { PermissionsService } = await import('../src')

beforeEach(() => {
	naviveCalls.addAceCalls.length = 0
	naviveCalls.addPrincipalCalls.length = 0
	naviveCalls.removeAceCalls.length = 0
	naviveCalls.removePrincipalCalls.length = 0
	naviveCalls.allowedAces.clear()
	naviveCalls.playerLicense = 'identifier.license:abc'
})

afterEach(() => {
	vi.clearAllMocks()
})

describe('PermissionsService', () => {
	it('hasPermission delegates to Permissions.isAllowed with nextvm prefix', () => {
		const perms = new PermissionsService()
		naviveCalls.allowedAces.add('1:nextvm.banking.read')
		expect(perms.hasPermission(1, 'banking.read')).toBe(true)
		expect(perms.hasPermission(1, 'other')).toBe(false)
	})

	it('grantPermissionToRole emits an add_ace with the proper group + prefixed object', () => {
		const perms = new PermissionsService()
		perms.grantPermissionToRole('admin', 'banking.admin.setBalance')
		expect(naviveCalls.addAceCalls).toEqual([
			['group.nextv_admin', 'nextvm.banking.admin.setBalance', true],
		])
	})

	it('grantRole maps source license to principal and adds_principal', () => {
		const perms = new PermissionsService()
		const ok = perms.grantRole(1, 'admin')
		expect(ok).toBe(true)
		expect(naviveCalls.addPrincipalCalls).toEqual([
			['identifier.license:abc', 'group.nextv_admin'],
		])
	})

	it('grantRole returns false when no license available', () => {
		const perms = new PermissionsService()
		naviveCalls.playerLicense = null
		expect(perms.grantRole(1, 'admin')).toBe(false)
		expect(naviveCalls.addPrincipalCalls).toHaveLength(0)
	})

	it('revokeRole emits remove_principal', () => {
		const perms = new PermissionsService()
		perms.revokeRole(1, 'admin')
		expect(naviveCalls.removePrincipalCalls).toEqual([
			['identifier.license:abc', 'group.nextv_admin'],
		])
	})

	it('definePermission is idempotent', () => {
		const perms = new PermissionsService()
		perms.definePermission('banking.read')
		perms.definePermission('banking.read')
		expect(perms.getDefinedPermissions()).toHaveLength(1)
	})
})
