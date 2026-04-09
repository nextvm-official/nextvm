import { createHash } from 'node:crypto'
import { type Fetcher, defaultFetcher } from './http'
import {
	type ModuleListing,
	type ModuleManifest,
	moduleManifestSchema,
	type PublishResponse,
	publishResponseSchema,
	type SearchResponse,
	searchResponseSchema,
} from './schemas'

/**
 * RegistryClient — typed client for the NextVM module registry.
 * lands with the SaaS infrastructure in . Until then the
 * client can be pointed at any compliant API (community-hosted
 * registries, self-hosted instances, mocks for tests).
 */

export interface RegistryClientOptions {
	/** Registry base URL — defaults to the public NextVM registry */
	baseUrl?: string
	/** Auth token for publish + premium installs */
	token?: string
	/** Inject a custom fetcher (default: global fetch) */
	fetcher?: Fetcher
}

export class RegistryClient {
	private readonly baseUrl: string
	private readonly token: string | null
	private readonly fetcher: Fetcher

	constructor(opts: RegistryClientOptions = {}) {
		this.baseUrl = opts.baseUrl ?? 'https://registry.nextvm.dev'
		this.token = opts.token ?? null
		this.fetcher = opts.fetcher ?? defaultFetcher
	}

	/** Search the registry for modules matching a free-text query */
	async search(query: string): Promise<SearchResponse> {
		const url = `${this.baseUrl}/search?q=${encodeURIComponent(query)}`
		const data = await this.requestJson('GET', url)
		const result = searchResponseSchema.safeParse(data)
		if (!result.success) {
			throw new Error(`Invalid search response: ${result.error.message}`)
		}
		return result.data
	}

	/** Get the manifest for a specific module + version */
	async getModule(name: string, version = 'latest'): Promise<ModuleManifest> {
		const url = `${this.baseUrl}/modules/${encodeURIComponent(name)}/${encodeURIComponent(version)}`
		const data = await this.requestJson('GET', url)
		const result = moduleManifestSchema.safeParse(data)
		if (!result.success) {
			throw new Error(`Invalid manifest: ${result.error.message}`)
		}
		return result.data
	}

	/** Resolve `name` to its latest version string (without downloading) */
	async resolveLatest(name: string): Promise<string> {
		const url = `${this.baseUrl}/modules/${encodeURIComponent(name)}/latest`
		const data = await this.requestJson('GET', url)
		const result = moduleManifestSchema.safeParse(data)
		if (!result.success) {
			throw new Error(`Invalid manifest: ${result.error.message}`)
		}
		return result.data.version
	}

	/**
	 * Download the tarball bytes for a module version.
	 * The caller is responsible for extracting them onto disk.
	 * Verifies the SHA-256 against the manifest to detect tampering.
	 */
	async downloadTarball(manifest: ModuleManifest): Promise<Uint8Array> {
		const headers: Record<string, string> = {}
		if (this.token) headers.Authorization = `Bearer ${this.token}`

		const res = await this.fetcher({
			method: 'GET',
			url: manifest.tarballUrl,
			headers,
		})
		if (res.status >= 400) {
			throw new Error(`Tarball download failed: ${res.status}`)
		}
		// Note: a real implementation would stream binary directly. For
		// the client we treat the body as a base64 or raw string;
		// the build of binary support lands when @nextvm/build wires this
		// into `nextvm add`.
		const bytes = new TextEncoder().encode(res.body)

		const hash = createHash('sha256').update(bytes).digest('hex')
		if (hash !== manifest.tarballSha256) {
			throw new Error(
				`Tarball integrity check failed: expected ${manifest.tarballSha256}, got ${hash}`,
			)
		}
		return bytes
	}

	/**
	 * Publish a module to the registry.
	 * Requires an auth token. The caller passes the manifest + tarball
	 * bytes; the client posts them to the registry's /publish endpoint
	 * and returns the canonical URL of the published version.
	 */
	async publish(manifest: ModuleManifest, tarball: Uint8Array): Promise<PublishResponse> {
		if (!this.token) {
			throw new Error('publish() requires an auth token — pass it via RegistryClientOptions')
		}
		const body = JSON.stringify({
			manifest,
			tarballBase64: Buffer.from(tarball).toString('base64'),
		})
		const data = await this.requestJson('POST', `${this.baseUrl}/publish`, body)
		const result = publishResponseSchema.safeParse(data)
		if (!result.success) {
			throw new Error(`Invalid publish response: ${result.error.message}`)
		}
		return result.data
	}

	/**
	 * Verify a license key for a premium module at build time.
	 */
	async verifyLicense(moduleName: string, licenseKey: string): Promise<{ valid: boolean }> {
		const data = await this.requestJson(
			'POST',
			`${this.baseUrl}/licenses/verify`,
			JSON.stringify({ module: moduleName, key: licenseKey }),
		)
		// Response shape: { valid: boolean }
		if (typeof data === 'object' && data !== null && 'valid' in data) {
			return { valid: Boolean((data as { valid: unknown }).valid) }
		}
		throw new Error('Invalid license verification response')
	}

	private async requestJson(
		method: 'GET' | 'POST' | 'PUT' | 'DELETE',
		url: string,
		body?: string,
	): Promise<unknown> {
		const headers: Record<string, string> = {
			Accept: 'application/json',
		}
		if (body !== undefined) headers['Content-Type'] = 'application/json'
		if (this.token) headers.Authorization = `Bearer ${this.token}`

		const res = await this.fetcher({ method, url, headers, body })
		if (res.status >= 400) {
			throw new Error(`Registry API error ${res.status}: ${res.body}`)
		}
		try {
			return JSON.parse(res.body)
		} catch {
			throw new Error(`Registry returned non-JSON body (${res.status}): ${res.body}`)
		}
	}
}

/** Re-export the listing type so consumers can type their UI */
export type { ModuleListing }
