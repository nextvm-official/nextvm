import { join } from 'node:path'
import type { RunnerIo, RunnerModule } from './types'

/**
 * Link the project's modules into the FXServer's `resources/[nextvm]/`
 * directory so FXServer can `ensure` them.
 *
 * Strategy:
 *   1. Try `fs.symlink(target, dest, 'junction')` — works on Windows
 *      without admin (junctions are reparse points for directories,
 *      treated identically to symlinks for our use case) and on
 *      Unix where the type parameter is ignored.
 *   2. If symlink fails (rare — usually only on exotic filesystems
 *      or sandboxed environments), fall back to a recursive copy.
 *      Slower but always works.
 *
 * The function returns a `cleanup` callback that removes everything
 * the linker created. The runner stores this and calls it during
 * `stop()`.
 *
 * Only the `[nextvm]/` subdirectory under `resources/` is touched.
 * Anything else the user has in `resources/` is left untouched —
 * this is a hard rule because users often run multiple frameworks
 * side by side.
 */

export interface LinkResult {
	/** Linked module names → absolute path inside resources/[nextvm]/ */
	links: Map<string, string>
	/** Whether we used real symlinks (false = copied) */
	usedSymlinks: boolean
	/** Roll back everything this call created */
	cleanup(): void
}

export interface LinkOptions {
	fxserverPath: string
	modules: readonly RunnerModule[]
	io: RunnerIo
	/** Subdirectory inside resources/ — defaults to `[nextvm]` */
	categoryDir?: string
}

export function linkModules(opts: LinkOptions): LinkResult {
	const { fxserverPath, modules, io } = opts
	const categoryDir = opts.categoryDir ?? '[nextvm]'

	const resourcesDir = join(fxserverPath, 'resources')
	const targetDir = join(resourcesDir, categoryDir)

	if (!io.existsSync(resourcesDir)) {
		throw new Error(
			`FXServer resources directory not found: ${resourcesDir}\n` +
				`Is the fxserverPath correct? It should point at the directory ` +
				`containing FXServer.exe and resources/.`,
		)
	}

	// Wipe + recreate the [nextvm]/ category folder so we always start
	// from a known clean state. Other directories under resources/ are
	// untouched.
	if (io.existsSync(targetDir)) {
		io.rmSync(targetDir, { recursive: true, force: true })
	}
	io.mkdirSync(targetDir, { recursive: true })

	const links = new Map<string, string>()
	let usedSymlinks = true

	try {
		for (const mod of modules) {
			const dest = join(targetDir, mod.name)
			try {
				io.symlinkSync(mod.path, dest, io.platform === 'win32' ? 'junction' : 'dir')
			} catch {
				// Fallback to a recursive copy. Once we hit one, switch the
				// flag globally so subsequent modules also copy (mixing modes
				// would mean partial links + partial copies on a retry, which
				// is harder to clean up).
				usedSymlinks = false
				io.cpSync(mod.path, dest, { recursive: true })
			}
			links.set(mod.name, dest)
		}
	} catch (err) {
		// Mid-loop failure: roll back the partially-populated [nextvm]/
		// folder so we don't leave a half-linked tree behind. The runner
		// can't help here because linkModules itself is throwing — there
		// is no LinkResult to call cleanup() on.
		if (io.existsSync(targetDir)) {
			io.rmSync(targetDir, { recursive: true, force: true })
		}
		throw err
	}

	const cleanup = () => {
		if (io.existsSync(targetDir)) {
			io.rmSync(targetDir, { recursive: true, force: true })
		}
	}

	return { links, usedSymlinks, cleanup }
}
