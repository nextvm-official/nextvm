/**
 * @nextvm/voice — Server-authoritative voice service.
 *
 * Concept v2.3, Chapter 20.
 *
 * Sits on top of the raw pma-voice wrapper from @nextvm/natives and
 * adds:
 *
 *   - typed radio-channel registry with ACL hooks
 *   - per-character proximity tracking
 *   - phone-call sessions with id correlation
 *   - mute with optional expiry
 *
 * The service depends on a `VoiceAdapter` interface, not on
 * @nextvm/natives directly, so every concept can be unit-tested in
 * plain Node.
 */

export { VoiceService } from './service'
export type { RadioChannelDefinition, PhoneCall } from './service'
export { InMemoryVoiceAdapter } from './adapter'
export type { VoiceAdapter, ProximityMode } from './adapter'
export { createNativesVoiceAdapter } from './natives-adapter'
