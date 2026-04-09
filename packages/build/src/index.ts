/**
 * @nextvm/build — NextVM build orchestrator
 *
 * Concept v2.3, Chapter 15.
 *
 * Provides the project loader + build pipeline + dev mode that the
 * @nextvm/cli wraps as the user-facing `nextvm build` and `nextvm dev`
 * commands. Also reusable from tests, IDE integrations, or CI scripts.
 */

export { loadProject } from './project-loader'
export type { LoadedProject, ResolvedModule } from './project-loader'

export { projectConfigSchema } from './project-schema'
export type { ProjectConfig } from './project-schema'

export { runBuild } from './build-orchestrator'
export type {
	BuildResult,
	BuildModuleResult,
	BuildOptions,
} from './build-orchestrator'

export { runDev } from './dev-orchestrator'
export type { DevOptions, DevSession } from './dev-orchestrator'

export { writeDevTrigger } from './dev-trigger'
export type { DevTriggerPayload, WriteDevTriggerOptions } from './dev-trigger'

export { generateFxmanifest } from './fxmanifest'
export type { FxmanifestOptions } from './fxmanifest'

export { bundleLocales } from './locale-bundler'
export type { LocaleBundleResult, BundledLocale } from './locale-bundler'
