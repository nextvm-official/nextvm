/**
 * @example/core — Bootstrap module for the Full Stack Example.
 *
 * Concept v2.3, Chapter 8.
 *
 * This module has no game logic of its own — it exists purely to
 * `bootstrapServer()` on the server side and `bootstrapClient()` on
 * the client side. Every other module is a regular game module that
 * gets registered by name; the runtime takes care of the lifecycle.
 *
 * Treat this file as the single source of truth for "how does NextVM
 * actually start a server resource".
 */

import { defineModule, z } from '@nextvm/core'

export default defineModule({
	name: 'core',
	version: '0.1.0',

	// Listed in dependency order so the loader's topological sort puts
	// this module last. Each name must match a registered module.
	dependencies: [
		'banking',
		'jobs',
		'housing',
		'inventory',
		'player',
		'vehicle',
	],

	config: z.object({
		motd: z.string().default('Welcome to NextVM!').describe('Message of the day'),
		enableCompat: z
			.boolean()
			.default(false)
			.describe('Expose ESX/QBCore exports for legacy resources'),
		enableDevBridge: z
			.boolean()
			.default(false)
			.describe('Watch .nextvm/dev-trigger.json and ensure-restart on change'),
	}),

	server: async (ctx) => {
		ctx.log.info('Full Stack Example loading…', { motd: ctx.config.motd })
		// Real server wiring lives in ./server/index.ts so this file
		// stays a clean defineModule entry point.
		await import('./server/index')
	},

	client: async (ctx) => {
		ctx.log.info('Full Stack Example client loading…')
		await import('./client/index')
	},
})
