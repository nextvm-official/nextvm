import { createWriteStream, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pipeline } from 'node:stream/promises'
import { execFileSync } from 'node:child_process'
import { Readable } from 'node:stream'

/**
 * Cfx.re JSON API endpoints that return the recommended FXServer build
 * for each platform. The `recommended_download` field is a direct URL
 * to the archive (server.zip on Windows, fx.tar.xz on Linux).
 */
const VERSION_API: Record<string, string> = {
	win32: 'https://changelogs-live.fivem.net/api/changelog/versions/win32/server',
	linux: 'https://changelogs-live.fivem.net/api/changelog/versions/linux/server',
}

export interface ResolvedBuild {
	/** Build number, e.g. "25770" */
	build: string
	/** Direct download URL for the archive */
	url: string
}

/**
 * Query the Cfx.re API for the latest recommended FXServer build.
 */
export async function resolveRecommendedBuild(
	platform: 'win32' | 'linux' = process.platform as 'win32' | 'linux',
): Promise<ResolvedBuild> {
	const apiUrl = VERSION_API[platform]
	if (!apiUrl) {
		throw new Error(
			`FXServer does not have official builds for ${platform}. ` +
				`Use Windows or Linux, or pass --no-fxserver to skip the download.`,
		)
	}

	const res = await fetch(apiUrl)
	if (!res.ok) {
		throw new Error(
			`Failed to query Cfx.re version API (${res.status}): ${apiUrl}`,
		)
	}

	const json = (await res.json()) as Record<string, string>
	const build = json.recommended
	const url = json.recommended_download

	if (!build || !url) {
		throw new Error(
			`Cfx.re API returned unexpected shape — missing recommended or recommended_download`,
		)
	}

	return { build, url }
}

/**
 * Download the FXServer artifact archive and extract it into `targetDir`.
 *
 * - Windows: server.zip → extracted via `tar -xf` (built into Win10+)
 * - Linux: fx.tar.xz → extracted via `tar xf`
 *
 * @param onProgress Optional callback receiving bytes downloaded so far
 *                   and total size (-1 if unknown).
 */
export async function downloadFxserver(
	url: string,
	targetDir: string,
	onProgress?: (downloaded: number, total: number) => void,
): Promise<void> {
	mkdirSync(targetDir, { recursive: true })

	const res = await fetch(url)
	if (!res.ok || !res.body) {
		throw new Error(`Failed to download FXServer artifact (${res.status}): ${url}`)
	}

	const total = Number(res.headers.get('content-length') ?? -1)
	const archiveName = url.endsWith('.tar.xz') ? 'fx.tar.xz' : 'server.zip'
	const archivePath = join(targetDir, archiveName)

	// Stream to disk with progress
	let downloaded = 0
	const reader = res.body.getReader()
	const fileStream = createWriteStream(archivePath)

	const nodeStream = new Readable({
		async read() {
			const { done, value } = await reader.read()
			if (done) {
				this.push(null)
				return
			}
			downloaded += value.byteLength
			onProgress?.(downloaded, total)
			this.push(Buffer.from(value))
		},
	})

	await pipeline(nodeStream, fileStream)

	// Extract
	try {
		if (archiveName === 'server.zip') {
			// Windows: PowerShell's Expand-Archive is the most reliable
			// zip extractor on every Windows 10+ machine. We pass
			// absolute paths because execFileSync cwd + PowerShell
			// relative paths don't always agree.
			try {
				// resolve() normalizes to absolute Windows-style paths
				// (C:\...) which PowerShell requires. Node's join() can
				// produce Unix-style paths when running inside Git Bash.
				execFileSync('powershell', [
					'-NoProfile', '-Command',
					`Expand-Archive -Path '${resolve(archivePath)}' -DestinationPath '${resolve(targetDir)}' -Force`,
				], { stdio: 'ignore' })
			} catch {
				// Fallback to tar (works on some Windows versions)
				execFileSync('tar', ['-xf', archiveName], { cwd: targetDir, stdio: 'ignore' })
			}
		} else {
			execFileSync('tar', ['xf', archiveName], { cwd: targetDir, stdio: 'ignore' })
		}
	} catch (err) {
		throw new Error(
			`Failed to extract ${archiveName}. ` +
				`Error: ${err instanceof Error ? err.message : String(err)}`,
		)
	}

	// Remove archive after extraction (keep the folder clean)
	const { unlinkSync } = await import('node:fs')
	try {
		unlinkSync(archivePath)
	} catch {
		// Non-critical — archive stays, no big deal
	}
}

/**
 * Clone cfx-server-data into `targetDir` using degit-style tarball
 * download (fast, no .git history). Falls back to shallow git clone.
 */
export async function cloneServerData(targetDir: string): Promise<void> {
	mkdirSync(targetDir, { recursive: true })

	// Try GitHub tarball first (fastest, no git needed)
	const tarballUrl =
		'https://github.com/citizenfx/cfx-server-data/archive/refs/heads/master.tar.gz'

	try {
		const res = await fetch(tarballUrl)
		if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`)

		const tarPath = join(targetDir, '_cfx-server-data.tar.gz')
		const fileStream = createWriteStream(tarPath)
		const reader = res.body.getReader()
		const nodeStream = new Readable({
			async read() {
				const { done, value } = await reader.read()
				if (done) {
					this.push(null)
					return
				}
				this.push(Buffer.from(value))
			},
		})
		await pipeline(nodeStream, fileStream)

		// Extract — the tarball contains a cfx-server-data-master/ prefix
		// that we strip with --strip-components=1
		execFileSync('tar', ['xf', '_cfx-server-data.tar.gz', '--strip-components=1'], {
			cwd: targetDir,
			stdio: 'ignore',
		})

		const { unlinkSync } = await import('node:fs')
		try {
			unlinkSync(tarPath)
		} catch {
			// ignore
		}
		return
	} catch {
		// Tarball failed — fall back to shallow git clone
	}

	// Fallback: shallow git clone
	try {
		execFileSync(
			'git',
			['clone', '--depth=1', 'https://github.com/citizenfx/cfx-server-data.git', '.'],
			{ cwd: targetDir, stdio: 'ignore' },
		)
	} catch (err) {
		throw new Error(
			`Failed to download cfx-server-data. Check your internet connection. ` +
				`Error: ${err instanceof Error ? err.message : String(err)}`,
		)
	}
}

/**
 * Read the stored build number from `.fxserver/.build`, or null if
 * not present.
 */
export function readStoredBuild(fxserverDir: string): string | null {
	try {
		return readFileSync(join(fxserverDir, '.build'), 'utf-8').trim()
	} catch {
		return null
	}
}

/**
 * Write the build number to `.fxserver/.build`.
 */
export function writeStoredBuild(fxserverDir: string, build: string): void {
	writeFileSync(join(fxserverDir, '.build'), build, 'utf-8')
}
