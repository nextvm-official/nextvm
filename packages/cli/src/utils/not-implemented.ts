import { cliLog } from './logger'

/**
 * Stub helper for commands that are not yet fully implemented.
 * that is not yet built (full dev/build pipeline, hosting deploy target,
 * registry API). These commands are scaffolded with this stub so the
 * surface area matches the concept and can be filled in later.
 */
export function notImplemented(command: string, reason: string): void {
	cliLog.warn(`'nextvm ${command}' is not yet implemented.`)
	cliLog.step(reason)
	process.exit(2)
}
