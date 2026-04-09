# @nextvm/voice

A higher-level, server-authoritative voice service that sits on top of
the raw `pma-voice` wrapper from [`@nextvm/natives`](/packages/natives).

Provides typed radio-channel ACLs, per-character proximity, phone-call
sessions, and mute-with-expiry — all unit-testable in plain Node via an
injected adapter.

## Install

```bash
pnpm add @nextvm/voice
```

## Usage

### Production

```typescript
import { VoiceService, createNativesVoiceAdapter } from '@nextvm/voice'

const voice = new VoiceService(await createNativesVoiceAdapter())

voice.registerChannel({
  id: 100,
  label: 'Police',
  canJoin: (source) => permissions.has(source, 'job.police'),
})

voice.join(playerSource, 100)
voice.setProximity(playerSource, 'shout')
const call = voice.startCall(callerSource, targetSource)
voice.mute(playerSource, { durationMs: 60_000 })
```

### Testing

```typescript
import { VoiceService, InMemoryVoiceAdapter } from '@nextvm/voice'

const adapter = new InMemoryVoiceAdapter()
const voice = new VoiceService(adapter)

voice.registerChannel({ id: 1, label: 'a' })
voice.join(7, 1)
expect(adapter.radio.get(7)).toBe(1)
```

## API

### Radio channels

| Method | Purpose |
|---|---|
| `registerChannel(def)` | Add a channel with optional `canJoin` ACL |
| `listChannels()` | All registered channels |
| `join(source, id)` | Join — leaves any previous channel first |
| `leave(source)` | Leave the current channel |
| `channelOf(source)` | Current channel id, or `null` |
| `membersOf(id)` | Sources currently in the channel |

### Proximity

| Method | Purpose |
|---|---|
| `setProximity(source, mode)` | `'whisper'` / `'normal'` / `'shout'` |

### Phone calls

| Method | Purpose |
|---|---|
| `startCall(caller, target)` | Returns a `PhoneCall` with a unique id |
| `endCall(source)` | End the source's current call |
| `getCall(source)` | Active call, or `null` |

### Mute

| Method | Purpose |
|---|---|
| `mute(source, { durationMs? })` | Optional auto-unmute |
| `unmute(source)` | Force unmute now |

### Lifecycle

| Method | Purpose |
|---|---|
| `dropSource(source)` | Cleanup channel + call + mute (call from `onPlayerDropped`) |

## Architecture

The service depends only on the `VoiceAdapter` interface:

```typescript
interface VoiceAdapter {
  setProximity(source: number, mode: ProximityMode): void
  setRadioChannel(source: number, channel: number): void
  setCallChannel(source: number, channel: number): void
  setMuted(source: number, muted: boolean): void
}
```

`createNativesVoiceAdapter()` returns a real adapter that delegates to
`@nextvm/natives` Voice (which in turn calls `pma-voice` exports).
`InMemoryVoiceAdapter` records every call so unit tests can assert on
the resulting state directly.

## See also

- [`@nextvm/natives`](/packages/natives) — raw `pma-voice` wrapper
- [com/nextvm-official/nextvm/tree/main/docs/concept)
