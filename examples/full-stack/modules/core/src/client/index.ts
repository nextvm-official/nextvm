/**
 * Client bootstrap for the Full Stack Example.
 * Mirror of server/index.ts on the client side. Boots the client
 * runtime, mounts the typed RPC client proxies, and lets the NUI app
 * find the bus through the global window.
 * The actual NUI React app lives under modules/core/nui/ and ships as
 * a separate Vite build referenced by `ui_page` in fxmanifest.lua.
 */

import banking from '@nextvm/banking'
import housing from '@nextvm/housing'
import inventory from '@nextvm/inventory'
import jobs from '@nextvm/jobs'
import player from '@nextvm/player'
import vehicle from '@nextvm/vehicle'

import { bootstrapClient } from '@nextvm/runtime-client'
import { createClient } from '@nextvm/core'

import core from '../index'

const runtime = await bootstrapClient({
	modules: [banking, jobs, housing, inventory, player, vehicle, core],
})

// Typed RPC proxies. Each module's router type comes from its package
// so you get full editor autocomplete on every call.
//
// Cast to unknown first because the workspace types are not loaded
// in this example file at lint time — in your real project you'd
// import the router type directly from the module.
type AnyRouter = Parameters<typeof createClient>[0] extends infer N
	? N extends string
		? Parameters<typeof createClient<never>>[0]
		: never
	: never

const rpc = {
	banking: createClient('banking' as AnyRouter, runtime.transport.call),
	jobs: createClient('jobs' as AnyRouter, runtime.transport.call),
	inventory: createClient('inventory' as AnyRouter, runtime.transport.call),
	player: createClient('player' as AnyRouter, runtime.transport.call),
	vehicle: createClient('vehicle' as AnyRouter, runtime.transport.call),
	housing: createClient('housing' as AnyRouter, runtime.transport.call),
}

// Expose the RPC clients on a window global so the NUI app can pick
// them up via `window.nextvm.rpc.banking.getMyBalance()` without
// bundling the runtime into the NUI build.
;(globalThis as { nextvm?: unknown }).nextvm = { rpc, runtime }

export {}
