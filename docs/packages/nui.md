# @nextvm/nui

A typed message bus between the FiveM client runtime and a NUI browser
frame. Both sides speak the same wire protocol so React (or any other)
NUI code stays decoupled from FiveM specifics and is unit-testable in
plain JSDOM.

## Install

```bash
pnpm add @nextvm/nui
```

The package ships **two entry points**:

```typescript
import { NuiClient } from '@nextvm/nui/client'    // FiveM client side
import { NuiBrowser } from '@nextvm/nui/browser'  // NUI/React side
```

## Wire protocol

```
client → NUI:  { kind: 'event', channel, data }                                  (one-way)
client → NUI:  { kind: 'request', requestId, channel, data }                      (waits)
NUI → client:  fetch('https://<resource>/<channel>', { body })                    (waits)
NUI → client:  fetch('https://<resource>/__nextvm_response', { body })            (correlates client request)
```

The protocol is intentionally tiny — every NextVM-specific extension
lives on top of `channel` strings, not in new envelope shapes.

## Client side (in your `client.ts`)

```typescript
import { NuiClient } from '@nextvm/nui/client'

const nui = new NuiClient()

// Push state into the NUI
nui.emit('hud.update', { hp: 80, armor: 10 })

// Wait for the NUI to answer
const offers = await nui.request('shop.getOffers', { category: 'food' })

// React to NUI button clicks
nui.on('shop.buy', async (data, respond) => {
  const result = await placeOrder(data as { itemId: string })
  respond({ ok: true, balance: result.balance })
})

// Toggle focus / cursor for the NUI
nui.setFocus(true, true)
```

## NUI side (in your React app)

```typescript
import { NuiBrowser } from '@nextvm/nui/browser'

const nui = new NuiBrowser({ resourceName: 'my-server' })

// Subscribe to client → NUI pushes
nui.on('hud.update', (data) => {
  setHud(data as HudState)
})

// Call back into the client
const result = await nui.call('shop.buy', { itemId: 'water' })

// Answer client requests
nui.on('shop.getOffers', async (data) => {
  return await loadOffers(data)
})
```

## React hook (build it yourself)

```typescript
import { useEffect } from 'react'
import type { NuiBrowser } from '@nextvm/nui/browser'

export function useNuiMessage<T>(
  bus: NuiBrowser,
  channel: string,
  handler: (data: T) => void,
): void {
  useEffect(() => {
    return bus.on(channel, (data) => handler(data as T))
  }, [bus, channel, handler])
}
```

## API

### `NuiClient`

| Method | Purpose |
|---|---|
| `emit(channel, data?)` | Fire a one-way message into the NUI |
| `request(channel, data?)` | Send a request and await the response |
| `on(channel, handler)` | Register a NUI → client callback |
| `setFocus(hasFocus, hasCursor)` | Toggle the NUI focus + cursor |

### `NuiBrowser`

| Method | Purpose |
|---|---|
| `on(channel, handler)` | Subscribe to client → NUI events / requests |
| `call(channel, data?)` | POST to a NUI callback registered on the client |

## Testing

Both classes accept dependency overrides so you can unit-test them in
plain Node:

```typescript
const sent: unknown[] = []
const client = new NuiClient({
  send: (data) => sent.push(data),
  registerCallback: () => undefined,
})
client.emit('hud.update', { hp: 80 })
```

## See also

- [`@nextvm/runtime-client`](/packages/runtime-client) — the client runtime that hosts the NuiClient
- [com/nextvm-official/nextvm/tree/main/docs/concept)
