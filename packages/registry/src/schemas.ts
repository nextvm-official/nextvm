import { z } from 'zod'

/**
 * NextVM Registry schemas.
 *
 * Concept v2.3, Chapter 27:
 *   "npm-like registry for NextVM modules. Developer-to-developer
 *    sales (not player-facing). Revenue share 70/30. Auto-generated
 *    docs from Zod schemas. Security scanning. Version pinning."
 *
 * The registry is a thin layer over standard package metadata + a
 * tarball download URL. Premium modules carry a license-key check
 * that the build pipeline runs at build time, NEVER at runtime
 * (Concept Chapter 26.2).
 */

export const moduleListingSchema = z.object({
	name: z.string(),
	displayName: z.string().optional(),
	description: z.string().optional(),
	author: z.string().optional(),
	latestVersion: z.string(),
	tags: z.array(z.string()).default([]),
	premium: z.boolean().default(false),
	priceUsd: z.number().nullable().default(null),
	downloads: z.number().int().default(0),
})

export type ModuleListing = z.infer<typeof moduleListingSchema>

export const moduleManifestSchema = z.object({
	name: z.string(),
	version: z.string(),
	description: z.string().optional(),
	author: z.string().optional(),
	license: z.string().optional(),
	tarballUrl: z.string().url(),
	tarballSha256: z.string(),
	dependencies: z.array(z.string()).default([]),
	peerNextvmCore: z.string().optional(),
	premium: z.boolean().default(false),
})

export type ModuleManifest = z.infer<typeof moduleManifestSchema>

export const searchResponseSchema = z.object({
	results: z.array(moduleListingSchema),
	total: z.number().int(),
})

export type SearchResponse = z.infer<typeof searchResponseSchema>

export const publishResponseSchema = z.object({
	name: z.string(),
	version: z.string(),
	url: z.string(),
})

export type PublishResponse = z.infer<typeof publishResponseSchema>
