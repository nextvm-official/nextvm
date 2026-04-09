import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { RegistryClient } from '@nextvm/registry'
import type { Command } from 'commander'
import { cliLog } from '../utils/logger'

/**
 * `nextvm registry:*` — Module registry commands.
 *
 * Concept v2.3, Chapter 17 + 27.
 *
 * Phase 2 ships the CLI surface backed by @nextvm/registry. The
 * registry backend itself is Phase 3 SaaS — until then these commands
 * still work against any compliant API (community-hosted, self-hosted,
 * or stubbed).
 *
 * Authentication tokens are read from the NEXTVM_REGISTRY_TOKEN env var.
 */
export function registerRegistryCommands(program: Command): void {
	const registry = program
		.command('registry')
		.description('Module registry: search, publish, install')

	registry
		.command('search <query>')
		.description('Search the registry for modules')
		.option('--url <url>', 'Custom registry URL')
		.action(async (query: string, opts: { url?: string }) => {
			try {
				const client = new RegistryClient({ baseUrl: opts.url })
				cliLog.header(`Searching: ${query}`)
				const result = await client.search(query)
				if (result.results.length === 0) {
					cliLog.warn('No results found.')
					return
				}
				for (const r of result.results) {
					const tag = r.premium ? ' (premium)' : ''
					const price = r.priceUsd ? ` $${r.priceUsd}` : ''
					cliLog.success(`${r.name}@${r.latestVersion}${tag}${price}`)
					if (r.description) cliLog.step(r.description)
				}
				cliLog.info(`${result.total} result(s)`)
			} catch (err) {
				cliLog.error(err instanceof Error ? err.message : String(err))
				cliLog.step(
					'Hint: the public NextVM registry lands with the SaaS platform in Phase 3. Until then point --url at a community-hosted instance or run a local mock.',
				)
				process.exit(1)
			}
		})

	registry
		.command('publish')
		.description('Publish the current module to the registry')
		.option('--url <url>', 'Custom registry URL')
		.action(async (opts: { url?: string }) => {
			try {
				const token = process.env.NEXTVM_REGISTRY_TOKEN
				if (!token) {
					cliLog.error('NEXTVM_REGISTRY_TOKEN env var is required to publish.')
					process.exit(1)
				}

				const pkgPath = join(process.cwd(), 'package.json')
				if (!existsSync(pkgPath)) {
					cliLog.error('No package.json found in current directory.')
					process.exit(1)
				}
				const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8')) as {
					name?: string
					version?: string
					description?: string
				}
				if (!pkg.name || !pkg.version) {
					cliLog.error('package.json is missing name or version.')
					process.exit(1)
				}

				cliLog.header(`Publishing ${pkg.name}@${pkg.version}`)
				cliLog.warn('Tarball packing is delegated to a future tar utility.')
				cliLog.step(
					'Phase 2 publishes manifest metadata only — full tarball upload lands once the registry backend exists.',
				)

				const client = new RegistryClient({ baseUrl: opts.url, token })
				const result = await client.publish(
					{
						name: pkg.name,
						version: pkg.version,
						description: pkg.description,
						tarballUrl: `local://${pkg.name}-${pkg.version}.tar`,
						tarballSha256: 'pending',
						dependencies: [],
						premium: false,
					},
					new Uint8Array(),
				)
				cliLog.success(`Published: ${result.url}`)
			} catch (err) {
				cliLog.error(err instanceof Error ? err.message : String(err))
				process.exit(1)
			}
		})
}
