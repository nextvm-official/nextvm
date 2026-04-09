/**
 * @nextvm/vite-plugin-nui — Vite plugin for NextVM NUI apps.
 *
 * Concept v2.3, Chapter 19.3.
 *
 * Forces FiveM-compatible build settings, exposes a virtual module
 * `virtual:nextvm-nui` (resource name + NuiBrowser re-export), prints
 * the dev URL to use as `ui_page` while developing, and writes a
 * `fxmanifest.nui.lua` snippet on production builds.
 */

export { nextvmNui } from './plugin'
export type { NextvmNuiPluginOptions, VitePluginLike } from './plugin'
export { generateFxmanifestSnippet } from './fxmanifest'
export type { FxmanifestSnippetInput } from './fxmanifest'
export { VIRTUAL_ID, RESOLVED_VIRTUAL_ID, buildVirtualModuleSource } from './virtual-module'
