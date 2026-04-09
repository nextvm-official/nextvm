# @nextvm/registry

The marketplace client. Search, install, publish modules — typed,
SHA-256 verified, with build-time license checks for premium modules.

## Install

```bash
pnpm add @nextvm/registry
```

## RegistryClient

```typescript
import { RegistryClient } from '@nextvm/registry'

const reg = new RegistryClient({
  baseUrl: 'https://registry.nextvm.dev',  // optional, this is the default
  token: process.env.NEXTVM_REGISTRY_TOKEN, // required for publish + premium
})

// Search
const result = await reg.search('banking')
// → { results: [...], total: number }

// Get a specific manifest
const manifest = await reg.getModule('@nextvm-community/loans', '1.2.0')

// Resolve latest version
const version = await reg.resolveLatest('@nextvm-community/loans')

// Download tarball (verifies SHA-256)
const bytes = await reg.downloadTarball(manifest)

// Publish (requires token)
const result = await reg.publish(manifest, tarballBytes)

// Verify a premium license at build time (NOT runtime DRM)
const { valid } = await reg.verifyLicense('@nextvm-pro/inventory', licenseKey)
```

## Schemas

| Schema | Purpose |
|---|---|
| `moduleListingSchema` | Search-result entry with name, version, tags, premium flag |
| `moduleManifestSchema` | Full manifest with tarball URL + SHA-256 + dependencies |
| `searchResponseSchema` | `{ results: ModuleListing[], total: number }` |
| `publishResponseSchema` | `{ name, version, url }` after publish |

## Pluggable Fetcher

Same pattern as `@nextvm/tebex` — inject a custom `Fetcher` for tests:

```typescript
const reg = new RegistryClient({
  baseUrl: 'https://mock.registry',
  fetcher: async (req) => ({ status: 200, body: '{}' }),
})
```

## Tarball integrity

`downloadTarball()` verifies the downloaded bytes against
`manifest.tarballSha256` using `node:crypto`. A mismatch throws
immediately — no chance of running tampered code:

```
Tarball integrity check failed: expected abc123..., got def456...
```

## Build-time license verification

Premium modules use `verifyLicense` to gate the build, **never**
runtime DRM (Concept Chapter 26.2). The pattern:

```typescript
// Inside @nextvm/build:
if (manifest.premium) {
  const { valid } = await reg.verifyLicense(manifest.name, env.LICENSE_KEY)
  if (!valid) throw new Error(`Invalid license for ${manifest.name}`)
}
```

Once the build succeeds, the produced bundle has no license check —
it just runs.

## Phase 2 vs Phase 3

Phase 2 ships the **client**. The actual registry backend (search
index, tarball CDN, license server) is part of the SaaS platform and
lands in Phase 3. Until then the client can be pointed at any
compliant API:

- `--url https://your-self-hosted-instance/`
- A community-hosted registry
- A local mock for development

## Tests

`packages/registry/__tests__/` contains 8 tests covering search,
manifest fetch, tarball SHA verification (success + failure),
publish auth requirement, publish round-trip, and license verify.

## See also

- [Concept Chapter 27](https://github.com/nextvm-official/nextvm/tree/main/docs/concept)
- [`nextvm registry`](/cli/registry) commands
