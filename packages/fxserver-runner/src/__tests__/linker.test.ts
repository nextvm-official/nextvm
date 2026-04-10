import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { linkModules } from '../linker'
import type { RunnerIo } from '../types'

/** In-memory RunnerIo mock that records every call without touching disk. */
function buildMockIo(opts: {
	platform?: NodeJS.Platform
	failSymlink?: boolean
	existingPaths?: string[]
} = {}): RunnerIo & {
	calls: { kind: string; args: unknown[] }[]
	files: Set<string>
} {
	const calls: { kind: string; args: unknown[] }[] = []
	const files = new Set<string>(opts.existingPaths ?? [])

	return {
		platform: opts.platform ?? 'linux',
		calls,
		files,
		mkdirSync: vi.fn((path, o) => {
			calls.push({ kind: 'mkdirSync', args: [path, o] })
			files.add(path)
		}),
		existsSync: vi.fn((path) => {
			calls.push({ kind: 'existsSync', args: [path] })
			return files.has(path)
		}),
		readFileSync: vi.fn(() => ''),
		writeFileSync: vi.fn(),
		rmSync: vi.fn((path, o) => {
			calls.push({ kind: 'rmSync', args: [path, o] })
			files.delete(path)
		}),
		symlinkSync: vi.fn((target, path, type) => {
			calls.push({ kind: 'symlinkSync', args: [target, path, type] })
			if (opts.failSymlink) throw new Error('EPERM')
			files.add(path)
		}),
		cpSync: vi.fn((src, dest, o) => {
			calls.push({ kind: 'cpSync', args: [src, dest, o] })
			files.add(dest)
		}),
		spawn: vi.fn(),
		isProcessAlive: vi.fn(() => false),
	}
}

describe('linkModules', () => {
	const fxserverPath = '/srv/fivem'
	const modules = [
		{ name: 'banking', path: '/proj/modules/banking' },
		{ name: 'jobs', path: '/proj/modules/jobs' },
	]

	it('throws if the FXServer resources directory is missing', () => {
		const io = buildMockIo({ existingPaths: [] })
		expect(() => linkModules({ fxserverPath, modules, io })).toThrow(
			/resources directory not found/,
		)
	})

	it('creates [nextvm]/ category folder when resources/ exists', () => {
		const io = buildMockIo({ existingPaths: [join(fxserverPath, 'resources')] })
		linkModules({ fxserverPath, modules, io })
		expect(io.mkdirSync).toHaveBeenCalledWith(
			join(fxserverPath, 'resources', '[nextvm]'),
			{ recursive: true },
		)
	})

	it('wipes an existing [nextvm]/ folder before relinking', () => {
		const target = join(fxserverPath, 'resources', '[nextvm]')
		const io = buildMockIo({
			existingPaths: [join(fxserverPath, 'resources'), target],
		})
		linkModules({ fxserverPath, modules, io })
		expect(io.rmSync).toHaveBeenCalledWith(target, {
			recursive: true,
			force: true,
		})
	})

	it('creates one symlink per module', () => {
		const io = buildMockIo({ existingPaths: [join(fxserverPath, 'resources')] })
		const result = linkModules({ fxserverPath, modules, io })
		expect(result.usedSymlinks).toBe(true)
		expect(result.links.size).toBe(2)
		expect(result.links.get('banking')).toBe(
			join(fxserverPath, 'resources', '[nextvm]', 'banking'),
		)
		expect(io.symlinkSync).toHaveBeenCalledTimes(2)
	})

	it('uses junction type on Windows', () => {
		const io = buildMockIo({
			platform: 'win32',
			existingPaths: [join(fxserverPath, 'resources')],
		})
		linkModules({ fxserverPath, modules: [modules[0]!], io })
		expect(io.symlinkSync).toHaveBeenCalledWith(
			modules[0]!.path,
			expect.any(String),
			'junction',
		)
	})

	it('uses dir type on Linux', () => {
		const io = buildMockIo({
			platform: 'linux',
			existingPaths: [join(fxserverPath, 'resources')],
		})
		linkModules({ fxserverPath, modules: [modules[0]!], io })
		expect(io.symlinkSync).toHaveBeenCalledWith(
			modules[0]!.path,
			expect.any(String),
			'dir',
		)
	})

	it('falls back to copy when symlink fails', () => {
		const io = buildMockIo({
			failSymlink: true,
			existingPaths: [join(fxserverPath, 'resources')],
		})
		const result = linkModules({ fxserverPath, modules, io })
		expect(result.usedSymlinks).toBe(false)
		expect(io.cpSync).toHaveBeenCalledTimes(2)
	})

	it('cleanup removes the [nextvm]/ folder', () => {
		const io = buildMockIo({ existingPaths: [join(fxserverPath, 'resources')] })
		const result = linkModules({ fxserverPath, modules, io })
		// Reset the rmSync mock to count only cleanup calls
		io.rmSync = vi.fn((path) => {
			io.files.delete(path)
		})
		result.cleanup()
		expect(io.rmSync).toHaveBeenCalledWith(
			join(fxserverPath, 'resources', '[nextvm]'),
			{ recursive: true, force: true },
		)
	})

	it('cleanup is safe to call when nothing was created', () => {
		const io = buildMockIo({ existingPaths: [join(fxserverPath, 'resources')] })
		const result = linkModules({ fxserverPath, modules: [], io })
		expect(() => result.cleanup()).not.toThrow()
	})

	it('rolls back [nextvm]/ when a mid-loop link fails', () => {
		const io = buildMockIo({ existingPaths: [join(fxserverPath, 'resources')] })
		// First module symlinks fine, second throws on BOTH symlink and cp
		let n = 0
		io.symlinkSync = vi.fn((_t, path) => {
			n++
			if (n === 2) throw new Error('EPERM')
			io.files.add(path as string)
		})
		io.cpSync = vi.fn(() => {
			throw new Error('ENOSPC')
		})
		expect(() => linkModules({ fxserverPath, modules, io })).toThrow(/ENOSPC/)
		// Targetdir must have been wiped during rollback
		expect(io.files.has(join(fxserverPath, 'resources', '[nextvm]'))).toBe(false)
	})

	it('respects custom categoryDir override', () => {
		const io = buildMockIo({ existingPaths: [join(fxserverPath, 'resources')] })
		linkModules({
			fxserverPath,
			modules: [modules[0]!],
			io,
			categoryDir: '[my-stack]',
		})
		expect(io.symlinkSync).toHaveBeenCalledWith(
			modules[0]!.path,
			join(fxserverPath, 'resources', '[my-stack]', 'banking'),
			expect.any(String),
		)
	})
})
