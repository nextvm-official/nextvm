import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

/**
 * Writer side of the live ensure-restart bridge.
 * `@nextvm/runtime-server`. The dev orchestrator calls this after a
 * successful per-module rebuild; the runtime is watching the same path
 * and runs `ExecuteCommand('ensure <module>')` whenever a fresh trigger
 * appears.
 * Output:
 *   .nextvm/dev-trigger.json  →  { module, timestamp }
 * The path is relative to the project root by convention so the dev
 * orchestrator and the runtime resolve to the same file.
 */

export interface DevTriggerPayload {
	module: string
	timestamp: number
}

export interface WriteDevTriggerOptions {
	/** Project root — defaults to `process.cwd()` */
	rootDir?: string
	/** Trigger path relative to the root — defaults to `.nextvm/dev-trigger.json` */
	relPath?: string
	/** IO override (test injection) */
	io?: {
		write: (path: string, contents: string) => void
	}
}

export function writeDevTrigger(
	module: string,
	opts: WriteDevTriggerOptions = {},
): string {
	const rootDir = opts.rootDir ?? process.cwd()
	const relPath = opts.relPath ?? '.nextvm/dev-trigger.json'
	const fullPath = join(rootDir, relPath)
	const payload: DevTriggerPayload = { module, timestamp: Date.now() }
	const contents = JSON.stringify(payload)
	const io =
		opts.io ?? {
			write: (p: string, c: string) => {
				const dir = dirname(p)
				if (dir && !existsSync(dir)) mkdirSync(dir, { recursive: true })
				writeFileSync(p, c, 'utf-8')
			},
		}
	io.write(fullPath, contents)
	return fullPath
}
