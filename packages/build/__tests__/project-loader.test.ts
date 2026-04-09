import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { loadProject } from '../src'

describe('loadProject', () => {
	let root: string

	beforeEach(() => {
		root = mkdtempSync(join(tmpdir(), 'nextvm-test-'))
	})

	afterEach(() => {
		rmSync(root, { recursive: true, force: true })
	})

	const writeConfig = (body: string) => {
		writeFileSync(join(root, 'nextvm.config.ts'), body)
	}

	const writeModule = (name: string, pkg: Record<string, unknown>) => {
		const dir = join(root, 'modules', name)
		mkdirSync(dir, { recursive: true })
		writeFileSync(join(dir, 'package.json'), JSON.stringify(pkg))
	}

	it('loads a minimal config and returns defaults', async () => {
		writeConfig('export default {}')
		const project = await loadProject(root)
		expect(project.config.server.maxPlayers).toBe(32)
		expect(project.config.database.host).toBe('localhost')
		expect(project.modules).toEqual([])
	})

	it('throws when no config file is present', async () => {
		await expect(loadProject(root)).rejects.toThrow(/No nextvm.config/)
	})

	it('discovers modules in the modules/ directory', async () => {
		writeConfig('export default { modules: [] }')
		writeModule('banking', { name: '@nextvm/banking', version: '1.0.0' })
		writeModule('jobs', { name: '@nextvm/jobs', version: '1.0.0' })

		const project = await loadProject(root)
		expect(project.modules).toHaveLength(2)
		expect(project.modules.map((m) => m.name).sort()).toEqual(['@nextvm/banking', '@nextvm/jobs'])
	})

	it('respects an explicit modules allowlist', async () => {
		writeConfig(`export default { modules: ['@nextvm/banking'] }`)
		writeModule('banking', { name: '@nextvm/banking', version: '1.0.0' })
		writeModule('jobs', { name: '@nextvm/jobs', version: '1.0.0' })

		const project = await loadProject(root)
		expect(project.modules).toHaveLength(1)
		expect(project.modules[0]?.name).toBe('@nextvm/banking')
	})

	it('rejects invalid config with helpful message', async () => {
		writeConfig('export default { server: { maxPlayers: -5 } }')
		await expect(loadProject(root)).rejects.toThrow(/maxPlayers/)
	})

	it('skips modules without a package.json', async () => {
		writeConfig('export default {}')
		mkdirSync(join(root, 'modules', 'orphan'), { recursive: true })
		const project = await loadProject(root)
		expect(project.modules).toEqual([])
	})
})
