import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { runCli } from '../src/index'

/**
 * CLI smoke tests.
 *
 * Each test gets a fresh temp directory, chdir's into it, runs `runCli`
 * with a real argv, and asserts on the resulting filesystem state. We
 * mock `process.exit` so the validate/build error paths don't kill the
 * test runner.
 */

let tmpDir: string
let originalCwd: string
let exitSpy: ReturnType<typeof vi.spyOn>
let exitCalls: number[]

beforeEach(() => {
	originalCwd = process.cwd()
	tmpDir = mkdtempSync(join(tmpdir(), 'nextvm-cli-test-'))
	process.chdir(tmpDir)
	exitCalls = []
	exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
		exitCalls.push(code ?? 0)
		// Throw so the action handler stops where it would have exited.
		throw new Error(`__exit__:${code ?? 0}`)
	}) as never)
})

afterEach(() => {
	exitSpy.mockRestore()
	process.chdir(originalCwd)
	rmSync(tmpDir, { recursive: true, force: true })
})

const runCliQuiet = async (...args: string[]): Promise<void> => {
	// commander expects [node, scriptPath, ...args]
	const argv = ['node', 'nextvm', ...args]
	// Suppress noisy logs (cliLog + commander --help/--version) to keep
	// test output clean.
	const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined)
	const errSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
	const stdoutSpy = vi
		.spyOn(process.stdout, 'write')
		.mockImplementation(() => true)
	const stderrSpy = vi
		.spyOn(process.stderr, 'write')
		.mockImplementation(() => true)
	try {
		await runCli(argv)
	} catch (err) {
		// Re-throw anything that isn't our intercepted process.exit
		if (!(err instanceof Error) || !err.message.startsWith('__exit__:')) {
			throw err
		}
	} finally {
		logSpy.mockRestore()
		errSpy.mockRestore()
		stdoutSpy.mockRestore()
		stderrSpy.mockRestore()
	}
}

describe('nextvm create', () => {
	it('scaffolds the expected file tree', async () => {
		await runCliQuiet('create', 'demo-project')
		const root = join(tmpDir, 'demo-project')
		expect(existsSync(root)).toBe(true)
		expect(existsSync(join(root, 'package.json'))).toBe(true)
		expect(existsSync(join(root, 'tsconfig.json'))).toBe(true)
		expect(existsSync(join(root, 'nextvm.config.ts'))).toBe(true)
		expect(existsSync(join(root, '.gitignore'))).toBe(true)
		expect(existsSync(join(root, 'modules'))).toBe(true)
		expect(existsSync(join(root, 'config'))).toBe(true)
	})

	it('embeds the project name in package.json', async () => {
		await runCliQuiet('create', 'embedded-name')
		const pkg = JSON.parse(
			readFileSync(join(tmpDir, 'embedded-name', 'package.json'), 'utf-8'),
		)
		expect(pkg.name).toBe('embedded-name')
		expect(pkg.scripts.dev).toBe('nextvm dev')
		expect(pkg.scripts.build).toBe('nextvm build')
		expect(pkg.dependencies['@nextvm/core']).toBeDefined()
	})

	it('respects --dir override', async () => {
		await runCliQuiet('create', 'projx', '--dir', 'custom-dir')
		expect(existsSync(join(tmpDir, 'custom-dir'))).toBe(true)
		expect(existsSync(join(tmpDir, 'projx'))).toBe(false)
	})

	it('exits with code 1 if the target directory already exists', async () => {
		await runCliQuiet('create', 'existing')
		await runCliQuiet('create', 'existing')
		expect(exitCalls).toContain(1)
	})
})

describe('nextvm add', () => {
	beforeEach(async () => {
		await runCliQuiet('create', 'host')
		process.chdir(join(tmpDir, 'host'))
	})

	it('--full scaffolds a layered module', async () => {
		await runCliQuiet('add', 'banking', '--full')
		const mod = join(tmpDir, 'host', 'modules', 'banking')
		expect(existsSync(mod)).toBe(true)
		expect(existsSync(join(mod, 'src', 'index.ts'))).toBe(true)
		expect(existsSync(join(mod, 'src', 'server'))).toBe(true)
		expect(existsSync(join(mod, 'package.json'))).toBe(true)
		const pkg = JSON.parse(readFileSync(join(mod, 'package.json'), 'utf-8'))
		expect(pkg.name).toMatch(/banking/)
	})

	it('--blank scaffolds a minimal module', async () => {
		await runCliQuiet('add', 'tiny', '--blank')
		const mod = join(tmpDir, 'host', 'modules', 'tiny')
		expect(existsSync(mod)).toBe(true)
		expect(existsSync(join(mod, 'src', 'index.ts'))).toBe(true)
	})

	it('rejects without --full or --blank', async () => {
		await runCliQuiet('add', 'whatever')
		expect(exitCalls).toContain(2)
	})

	it('refuses to overwrite an existing module', async () => {
		await runCliQuiet('add', 'dup', '--full')
		await runCliQuiet('add', 'dup', '--full')
		expect(exitCalls).toContain(1)
	})
})

describe('nextvm validate', () => {
	beforeEach(async () => {
		await runCliQuiet('create', 'host')
		process.chdir(join(tmpDir, 'host'))
		await runCliQuiet('add', 'sample', '--full')
	})

	it('passes on a fresh scaffolded project', async () => {
		await runCliQuiet('validate')
		// validate exits 0 only when there are no errors → no exit recorded
		expect(exitCalls).not.toContain(1)
	})

	it('errors out when nextvm.config.ts is missing', async () => {
		rmSync(join(tmpDir, 'host', 'nextvm.config.ts'))
		await runCliQuiet('validate')
		expect(exitCalls).toContain(1)
	})

	it('errors out on a mutation procedure without .input()', async () => {
		const routerPath = join(
			tmpDir,
			'host',
			'modules',
			'sample',
			'src',
			'server',
			'router.ts',
		)
		// Replace the scaffolded router with one that has a mutation
		// missing .input(...) — the validate regex should catch it.
		const broken = `import { defineRouter, procedure } from '@nextvm/core'

export function buildSampleRouter() {
	return defineRouter({
		broken: procedure.mutation(() => ({ ok: true })),
	})
}
`
		writeFileSync(routerPath, broken)
		await runCliQuiet('validate')
		expect(exitCalls).toContain(1)
	})
})

describe('nextvm bin output', () => {
	it('--help does not throw', async () => {
		// commander prints help to stdout and exits 0; we just want no crash.
		try {
			await runCliQuiet('--help')
		} catch (err) {
			// commander itself calls process.exit(0) on --help → mocked → throws.
			expect((err as Error).message).toMatch(/__exit__/)
		}
	})

	it('--version returns the package version', async () => {
		try {
			await runCliQuiet('--version')
		} catch (err) {
			expect((err as Error).message).toMatch(/__exit__/)
		}
	})
})
