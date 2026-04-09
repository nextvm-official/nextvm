import { createLogger } from '@nextvm/core'
import { registerEsxExports } from './esx-mapper'
import { registerQbExports } from './qbcore-mapper'
import type { CompatDataSource, ExportsApi } from './types'

/**
 * Setup options for the compatibility layer.
 *
 * Concept v2.3, Chapter 16.1:
 *   "Phase A: Install NextVM alongside existing framework. Enable @nextvm/compat."
 *
 * The server bootstrap calls setupCompat() once during startup, after
 * CharacterService and the player/inventory modules are ready.
 */
export interface SetupCompatOptions {
	dataSource: CompatDataSource
	exportsApi: ExportsApi
	/** Which legacy frameworks to expose. Default: both */
	enable?: { esx?: boolean; qbcore?: boolean }
}

/**
 * Wire up the @nextvm/compat exports.
 *
 * After this returns, legacy Lua resources can call:
 *   local ESX = exports['es_extended']:getSharedObject()
 *   local QBCore = exports['qb-core']:GetCoreObject()
 *
 * and receive properly-shaped objects backed by NextVM data.
 */
export function setupCompat(opts: SetupCompatOptions): void {
	const log = createLogger('nextvm:compat')
	const enable = { esx: true, qbcore: true, ...opts.enable }

	if (enable.esx) {
		registerEsxExports(opts.exportsApi, opts.dataSource)
		log.info('ESX compatibility layer registered (es_extended)')
	}
	if (enable.qbcore) {
		registerQbExports(opts.exportsApi, opts.dataSource)
		log.info('QBCore compatibility layer registered (qb-core)')
	}
}
