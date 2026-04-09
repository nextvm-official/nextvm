# nextvm validate

Static checks on the current NextVM project. Catches the common
mistakes before they hit production.

## Synopsis

```bash
nextvm validate
```

## Checks performed

| Check | Severity | What it catches |
|---|---|---|
| `nextvm.config.ts` exists | error | The CLI needs the project config to do anything |
| Each module has `src/index.ts` | error | Module is malformed |
| Each module has `en.ts` locale | warning | GUARD-012 — i18n required |
| Modules importing `@nextvm/tebex` ship `MONETIZATION.md` | error | GUARD-013 — PLA compliance |
| Each module uses the layered `src/server/` structure | warning | MODULE_ARCHITECTURE.md convention |
| Declared dependencies have a matching `adapters/<dep>-adapter.ts` | warning | GUARD-002 — adapter pattern |
| RPC mutations have `.input(z.object(...))` | error | GUARD-005 — Zod validation |

The PLA-compliance check looks for **real import statements**, not
stray mentions in JSDoc comments — so a module that documents the
policy without consuming `@nextvm/tebex` does NOT trigger the warning.

## Exit codes

| Code | Meaning |
|---|---|
| 0 | All checks passed (warnings are non-fatal) |
| 1 | At least one check failed |

## Example output

```
ℹ Validating NextVM project
✓ nextvm.config.ts found
✓ Found 6 module(s)
⚠ Module 'banking' is not using the layered structure (src/server/service.ts + router.ts). See .ai/MODULE_ARCHITECTURE.md.
⚠ Module 'jobs' declares dependency 'banking' but has no adapters/banking-adapter.ts (GUARD-002 / MODULE_ARCHITECTURE §4)
✓ Validation passed (2 warnings)
```

## CI integration

Add it to your CI pipeline alongside `pnpm test`:

```yaml
- run: pnpm install
- run: pnpm run build
- run: pnpm test
- run: pnpm exec nextvm validate
```

The non-zero exit on errors makes it fail the build cleanly.

## See also

- [Architecture Guards](/reference/guards)
- [Module Authoring](/guide/module-authoring)
