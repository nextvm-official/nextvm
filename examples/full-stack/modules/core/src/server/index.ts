/**
 * Server bootstrap for the Full Stack Example.
 *
 * Concept v2.3, Chapter 8.3 + 11 + 13 + 16 + 20.
 *
 * Wires every NextVM layer:
 *   - bootstrapServer            → ModuleLoader + lifecycle bridge
 *   - DbCharacterRepository      → real MySQL persistence (with fallback)
 *   - setupCompat                → ESX + QBCore exports for legacy resources
 *   - VoiceService               → server-authoritative radio + calls
 *   - stateSnapshot              → hot-reload state preservation
 *   - devBridge                  → live ensure-restart from `nextvm dev`
 *
 * Reads the runtime config from FiveM convars so the same code runs in
 * dev and prod with no source changes.
 */

import banking from '@nextvm/banking'
import housing from '@nextvm/housing'
import inventory from '@nextvm/inventory'
import jobs from '@nextvm/jobs'
import player from '@nextvm/player'
import vehicle from '@nextvm/vehicle'

import { bootstrapServer } from '@nextvm/runtime-server'
import { setupCompat } from '@nextvm/compat'
import {
	createNativesVoiceAdapter,
	VoiceService,
} from '@nextvm/voice'

import core from '../index'

// Convar helpers — FiveM globals, declared here to keep this file
// self-contained without pulling a separate types package.
declare function GetConvar(name: string, defaultValue: string): string
declare function GetConvarBool(name: string, defaultValue: boolean): boolean

const isDev = GetConvarBool('nextvm_dev', false)

// --- Database ---
//
// In production, wire `DbCharacterRepository` from `@nextvm/db`. The
// runtime falls back to its built-in in-memory repository if you pass
// nothing here, which is exactly what we want for the very first run
// before MySQL is configured.
//
// Uncomment when you have credentials in convars:
//
//   import { Database, MySqlAdapter, DbCharacterRepository } from '@nextvm/db'
//   const db = new Database(new MySqlAdapter({
//     host: GetConvar('mysql_host', 'localhost'),
//     user: GetConvar('mysql_user', 'root'),
//     password: GetConvar('mysql_password', ''),
//     database: GetConvar('mysql_db', 'nextvm_example'),
//   }))
//   const characterRepository = new DbCharacterRepository(db)

const characterRepository = undefined // → in-memory fallback

// --- Voice ---
//
// VoiceService sits on top of `pma-voice` via `@nextvm/natives`. The
// real adapter is async because it lazy-imports natives so this file
// stays buildable on plain Node for tests.
async function buildVoice(): Promise<VoiceService> {
	const adapter = await createNativesVoiceAdapter()
	const voice = new VoiceService(adapter)
	voice.registerChannel({ id: 1, label: 'Public' })
	voice.registerChannel({
		id: 100,
		label: 'Police',
		canJoin: () => false, // wire to permissions module in real life
	})
	voice.registerChannel({
		id: 101,
		label: 'EMS',
		canJoin: () => false,
	})
	return voice
}

// --- Bootstrap ---
//
// Single entry point. After this returns the runtime is ready, every
// module's onModuleInit + onModuleReady has fired, every router is
// auto-registered onto the runtime's RpcRouter, and the FiveM event
// bridge is attached.

const runtime = await bootstrapServer({
	modules: [banking, jobs, housing, inventory, player, vehicle, core],
	characterRepository,
	registerCompat: ({ exportsApi, dataSource }) => {
		setupCompat({ exportsApi, dataSource })
	},
	stateSnapshot: {
		// 5 minutes is generous — long enough to survive a slow ensure
		// restart, short enough that a real cold boot is never confused
		// with a reload.
		staleAfterMs: 5 * 60_000,
	},
	devBridge: isDev,
})

// Voice is built async after the runtime is up so we don't block
// bootstrap on a `pma-voice` import that might not be available yet.
buildVoice()
	.then((voice) => {
		runtime.loader.getContainer().setResolved('voice', voice)
		runtime.loader
			.getEventBus()
			.emit('voice:ready', { channels: voice.listChannels().length })
	})
	.catch((err) => {
		console.error('[full-stack] voice bootstrap failed', err)
	})

export {}
