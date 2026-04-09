# nextvm registry

Search and publish modules to the NextVM module registry.

## Synopsis

```bash
nextvm registry:search <query> [--limit <n>]
nextvm registry:publish <module-path> [--token <token>] [--dry-run]
```

## registry:search

Search the registry for modules by name, description, or tag.

```bash
nextvm registry:search banking
nextvm registry:search "vehicle keys" --limit 5
```

| Option | Default | Description |
|---|---|---|
| `--limit <n>` | `10` | Max number of results |

### Example output

```
ℹ Searching registry for "banking"...

@nextvm/banking            0.0.1   Accounts, transfers, audit trail
@community/atm-banking     1.2.0   ATM blips + cash withdrawals
@community/banking-cards   0.4.1   Debit/credit card system

Found 3 result(s).
```

## registry:publish

Publish a built module to the registry. Requires:

1. The module has been built (`nextvm build`)
2. `package.json` has `name`, `version`, `description`
3. A valid registry token (env var `NEXTVM_REGISTRY_TOKEN` or `--token`)

```bash
nextvm registry:publish modules/banking
nextvm registry:publish modules/banking --dry-run
```

| Option | Default | Description |
|---|---|---|
| `--token <token>` | `$NEXTVM_REGISTRY_TOKEN` | Auth token |
| `--dry-run` | off | Validate + pack without uploading |

### What it does

1. Reads `modules/<name>/package.json`
2. Verifies `dist/` and `fxmanifest.lua` exist
3. Packs the module into a tarball (`.tgz`)
4. Computes SHA-256 checksum
5. POSTs to the registry endpoint with the token
6. Prints the published version URL

### Example

```
ℹ Publishing @community/atm-banking@1.2.0...
→ Packing modules/atm-banking → 24.1 KB
→ Checksum: sha256-1a2b3c...
→ Uploading...
✓ Published https://registry.nextvm.dev/p/atm-banking/1.2.0
```

## See also

- [`@nextvm/registry`](/packages/registry) package reference
- [PLA Compliance](/guide/pla-compliance) — what you can and can't publish
