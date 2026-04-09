/**
 * @nextvm/test-utils — Testing utilities for NextVM modules
 *
 * Concept v2.3, Chapter 31.
 *
 * Provides:
 *   - createMockContext()      — full ModuleContext with harness assertions
 *   - createMockEventBus()     — recording event bus with expectEmitted()
 *   - createMockLogger()       — recording logger with expectMessage()
 *   - createMockI18n()         — minimal i18n stub for tests
 *   - InMemoryCharacterRepository — DB-free CharacterRepository implementation
 */

export { createMockContext } from './mock-context'
export type { MockContext, MockContextOptions } from './mock-context'

export { createMockEventBus } from './mock-event-bus'
export type { MockEventBus } from './mock-event-bus'

export { createMockLogger } from './mock-logger'
export type { MockLogger } from './mock-logger'

export { createMockI18n } from './mock-i18n'
export type { MockI18n, MockI18nOptions } from './mock-i18n'

export { InMemoryCharacterRepository } from './mock-character-repository'

export { createModuleHarness, harnessFor } from './module-harness'
export type { ModuleHarness, ModuleHarnessOptions } from './module-harness'
