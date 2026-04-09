import type { ModuleLogger } from '../module/types'

type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR'

const LOG_LEVELS: Record<LogLevel, number> = {
	DEBUG: 0,
	INFO: 1,
	WARN: 2,
	ERROR: 3,
}

/**
 * Structured JSON logger per module.
 *   "Per-module logger with automatic context"
 *   Output format: { level, module, msg, data, timestamp, source? }
 *   Log levels configurable per module via config.
 */
export class Logger implements ModuleLogger {
	private minLevel: number

	constructor(
		private readonly module: string,
		level: LogLevel = 'INFO',
	) {
		this.minLevel = LOG_LEVELS[level]
	}

	debug(msg: string, data?: Record<string, unknown>): void {
		this.log('DEBUG', msg, data)
	}

	info(msg: string, data?: Record<string, unknown>): void {
		this.log('INFO', msg, data)
	}

	warn(msg: string, data?: Record<string, unknown>): void {
		this.log('WARN', msg, data)
	}

	error(msg: string, data?: Record<string, unknown>): void {
		this.log('ERROR', msg, data)
	}

	/** Create a child logger with additional context */
	child(context: Record<string, unknown>): Logger {
		const child = new Logger(this.module)
		child.minLevel = this.minLevel
		// Child inherits module but can add context
		const originalLog = child.log.bind(child)
		child.log = (level: LogLevel, msg: string, data?: Record<string, unknown>) => {
			originalLog(level, msg, { ...context, ...data })
		}
		return child
	}

	/** Set the minimum log level */
	setLevel(level: LogLevel): void {
		this.minLevel = LOG_LEVELS[level]
	}

	private log(level: LogLevel, msg: string, data?: Record<string, unknown>): void {
		if (LOG_LEVELS[level] < this.minLevel) return

		const entry = {
			level,
			module: this.module,
			msg,
			data: data ?? undefined,
			timestamp: new Date().toISOString(),
		}

		// Structured JSON output — parseable by log aggregators (Loki, Elasticsearch)
		// and by the SaaS dashboard
		const json = JSON.stringify(entry)

		switch (level) {
			case 'ERROR':
				console.error(json)
				break
			case 'WARN':
				console.warn(json)
				break
			default:
				console.log(json)
		}
	}
}

/**
 * Create a logger for a module.
 */
export function createLogger(moduleName: string, level?: LogLevel): Logger {
	return new Logger(moduleName, level)
}
