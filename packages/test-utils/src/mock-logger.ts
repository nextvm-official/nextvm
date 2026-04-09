import type { ModuleLogger } from '@nextvm/core'

/**
 * Recording logger — captures every log call so tests can assert on them.
 *
 * Concept v2.3, Chapter 31.
 */
export interface MockLogger extends ModuleLogger {
	/** All log entries since creation (or last reset()) */
	getEntries(): Array<{
		level: 'debug' | 'info' | 'warn' | 'error'
		msg: string
		data?: Record<string, unknown>
	}>
	/** Filter by level */
	getEntriesAtLevel(level: 'debug' | 'info' | 'warn' | 'error'): Array<{
		msg: string
		data?: Record<string, unknown>
	}>
	/** Throw if no entry contains the substring */
	expectMessage(substring: string): void
	reset(): void
}

export function createMockLogger(): MockLogger {
	const entries: Array<{
		level: 'debug' | 'info' | 'warn' | 'error'
		msg: string
		data?: Record<string, unknown>
	}> = []

	const record = (level: 'debug' | 'info' | 'warn' | 'error') =>
		(msg: string, data?: Record<string, unknown>) => {
			entries.push({ level, msg, data })
		}

	return {
		debug: record('debug'),
		info: record('info'),
		warn: record('warn'),
		error: record('error'),
		getEntries() {
			return [...entries]
		},
		getEntriesAtLevel(level) {
			return entries.filter((e) => e.level === level).map((e) => ({ msg: e.msg, data: e.data }))
		},
		expectMessage(substring) {
			if (!entries.some((e) => e.msg.includes(substring))) {
				throw new Error(
					`Expected log to contain '${substring}', but logged: ${entries.map((e) => `[${e.level}] ${e.msg}`).join('; ') || '(nothing)'}`,
				)
			}
		},
		reset() {
			entries.length = 0
		},
	}
}
