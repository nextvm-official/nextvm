# Permissions (ACE)

> Concept v2.3, Chapter 20.3

NextVM's RBAC sits **on top of** FiveM's built-in ACE system, not
parallel to it. Every NextVM permission is registered as an ACE entry
with the `nextvm.` prefix, and every NextVM role becomes an ACE group
named `group.nextv_<role>`.

This means txAdmin, vMenu, and any other ACE-aware tool can see and
manage NextVM permissions natively.

## PermissionsService

```typescript
import { PermissionsService } from '@nextvm/core'

const perms = new PermissionsService()

// Define what's possible
perms.definePermission('banking.admin.setBalance', {
  description: 'Set any character\'s bank balance',
})
perms.defineRole('admin')
perms.grantPermissionToRole('admin', 'banking.admin.setBalance')

// Apply to a player
perms.grantRole(source, 'admin')

// Check
if (perms.hasPermission(source, 'banking.admin.setBalance')) {
  // ...
}
```

Internally these calls map to FiveM ACE commands:

```
add_ace group.nextv_admin nextvm.banking.admin.setBalance allow
add_principal identifier.license:abc... group.nextv_admin
```

## Use with RPC

The RPC `procedure.auth(middleware)` is the canonical place to wire
permissions:

```typescript
const adminAudit: procedure
  .input(z.object({ charId: z.number() }))
  .auth((ctx) => perms.hasPermission(ctx.source, 'banking.admin.audit'))
  .query(async ({ input }) => loadAuditTrail(input.charId))
```

If the middleware returns false (or throws), the dispatcher raises
`RpcError('AUTH_ERROR', 'Permission denied')`.

## Naming conventions

| Concept | Format | Example |
|---|---|---|
| Permission | `<module>.<action>` or `<module>.<scope>.<action>` | `banking.transfer`, `banking.admin.setBalance` |
| Role | `<short-name>` | `admin`, `moderator`, `vip` |
| ACE entry | `nextvm.<permission>` | `nextvm.banking.transfer` |
| ACE group | `group.nextv_<role>` | `group.nextv_admin` |

The `nextvm.` and `group.nextv_` prefixes prevent collisions with
other resources' permissions.

## Coexistence with server.cfg

If your `server.cfg` already has ACE groups configured, NextVM doesn't
override them. Existing permissions stay in place; new ones get added
alongside.

## Discord integration

`@nextvm/discord` ships a `roleSync` feature that maps Discord roles
to NextVM permissions automatically:

```typescript
import { defineDiscord } from '@nextvm/discord'

const discord = defineDiscord({ ... })
discord.roleSync({
  VIP: 'nextvm.vip',
  Police: 'nextvm.jobs.police',
  Admin: 'nextvm.admin',
})
```

When a player connects, their Discord roles are checked and the
matching ACE permissions are granted automatically.

## Player principal resolution

`grantRole(source, role)` needs the player's license identifier to
build the ACE principal. The natives layer's
`Permissions.getLicensePrincipal(source)` reads it from
`GetPlayerIdentifiers`. If no license identifier is found,
`grantRole` returns false and logs a warning.

## See also

- [`@nextvm/core/permissions`](/packages/core)
- [`@nextvm/discord` role sync](/packages/discord)
- [Concept v2.3 Chapter 20.3](https://github.com/nextvm-official/nextvm/tree/main/docs/concept)
