/**
 * @nextvm/registry — NextVM module registry client
 *
 * Concept v2.3, Chapter 27 (Module Marketplace & Registry).
 *
 * Provides a typed client for searching, installing, and publishing
 * NextVM modules. The actual registry backend lands with the SaaS
 * platform in Phase 3 — until then this client can be pointed at any
 * compliant API (community registries, self-hosted, or mocks).
 *
 * Usage:
 *   import { RegistryClient } from '@nextvm/registry'
 *
 *   const reg = new RegistryClient()
 *   const results = await reg.search('banking')
 *   const manifest = await reg.getModule('@nextvm-community/loans')
 *   const tarball = await reg.downloadTarball(manifest)
 */

export { RegistryClient } from './client'
export type { RegistryClientOptions, ModuleListing } from './client'

export { defaultFetcher } from './http'
export type { Fetcher, FetcherRequest, FetcherResponse } from './http'

export {
	moduleListingSchema,
	moduleManifestSchema,
	searchResponseSchema,
	publishResponseSchema,
} from './schemas'
export type {
	ModuleManifest,
	SearchResponse,
	PublishResponse,
} from './schemas'
