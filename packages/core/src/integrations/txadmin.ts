import type { CharacterService } from '../character/character-service'
import type { EventBus } from '../events/event-bus'
import { createLogger } from '../logger/logger'
import type { ModuleLoader } from '../module/module-loader'

/**
 * txAdmin Integration.
 *   txAdmin emits events that NextVM must handle:
 *     - txAdmin:events:scheduledRestart  → graceful save of all player data
 *     - txAdmin:events:playerKicked      → remove from state, persist character
 *     - txAdmin:events:playerWarned      → store warning in user record
 *     - txAdmin:events:playerBanned      → sync ban to user table
 *     - txAdmin:events:serverShuttingDown→ emergency save, fire onModuleStop
 * The actual FiveM event registration happens via the framework's
 * network primitives (RegisterNetEvent + AddEventHandler). This file
 * provides the typed handler that wires those low-level events into
 * the NextVM lifecycle.
 */

export interface TxAdminIntegrationDeps {
	loader: ModuleLoader
	eventBus: EventBus
	characters: CharacterService
}

/** Listener registration callback — provided by the FiveM bootstrap layer */
export type TxAdminEventBinder = (
	eventName: string,
	handler: (data: unknown) => void | Promise<void>,
) => void

/**
 * Bind txAdmin events to NextVM lifecycle hooks.
 * The `binder` argument is supplied by the framework's network/runtime
 * layer (which calls RegisterNetEvent + AddEventHandler). Tests can
 * pass a stub binder.
 * Usage (bootstrap):
 *   bindTxAdmin(binder, { loader, eventBus, characters })
 */
export function bindTxAdmin(
	binder: TxAdminEventBinder,
	deps: TxAdminIntegrationDeps,
): void {
	const log = createLogger('nextvm:txadmin')

	// Scheduled restart — fire warning, give modules time to save
	binder('txAdmin:events:scheduledRestart', async (data) => {
		log.warn('txAdmin scheduled restart imminent', { data })
		deps.eventBus.emit('server:scheduledRestart', data)
		// Save all active player characters
		for (const session of deps.characters.getActivePlayers()) {
			await deps.characters.saveCurrentCharacter(session.source).catch((err) => {
				log.error('Failed to save character on scheduled restart', {
					source: session.source,
					error: err instanceof Error ? err.message : String(err),
				})
			})
		}
	})

	// Player kicked
	binder('txAdmin:events:playerKicked', async (data) => {
		const payload = data as { id: number; reason?: string } | undefined
		if (!payload) return
		log.info('Player kicked by txAdmin', { source: payload.id, reason: payload.reason })
		deps.eventBus.emit('player:kicked', payload)
		await deps.characters.saveAndRemoveSession(payload.id).catch((err) => {
			log.error('Failed to save+remove session on kick', {
				source: payload.id,
				error: err instanceof Error ? err.message : String(err),
			})
		})
	})

	// Player warned
	binder('txAdmin:events:playerWarned', (data) => {
		log.info('Player warned by txAdmin', { data })
		deps.eventBus.emit('player:warned', data)
	})

	// Player banned
	binder('txAdmin:events:playerBanned', (data) => {
		log.warn('Player banned by txAdmin', { data })
		deps.eventBus.emit('player:banned', data)
	})

	// Server shutting down — emergency save
	binder('txAdmin:events:serverShuttingDown', async (data) => {
		log.warn('Server shutting down', { data })
		deps.eventBus.emit('server:shuttingDown', data)
		for (const session of deps.characters.getActivePlayers()) {
			await deps.characters.saveCurrentCharacter(session.source).catch(() => {
				/* swallow during shutdown */
			})
		}
	})
}
