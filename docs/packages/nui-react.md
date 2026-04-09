# @nextvm/nui-react

React hooks for the [`@nextvm/nui`](/packages/nui) bridge. Drop into
any Vite + React NUI app to get typed channel subscriptions, request
state tracking, and a context provider that hands the bus to the whole
component tree.

## Install

```bash
pnpm add @nextvm/nui @nextvm/nui-react react
```

## Setup

```typescript
// src/main.tsx
import { createRoot } from 'react-dom/client'
import { NuiBrowser } from '@nextvm/nui/browser'
import { NuiProvider } from '@nextvm/nui-react'
import { resourceName } from 'virtual:nextvm-nui'
import App from './App'

const bus = new NuiBrowser({ resourceName })

createRoot(document.getElementById('root')!).render(
  <NuiProvider bus={bus}>
    <App />
  </NuiProvider>,
)
```

## Hooks

### `useNuiMessage<T>(channel, handler)`

Subscribe to a one-way push from the FiveM client. The handler is held
in a stable ref so re-renders don't churn the underlying subscription.

```typescript
useNuiMessage<HudState>('hud.update', (state) => {
  setHud(state)
})
```

### `useNuiState<T>(channel, initial)`

Sugar over `useNuiMessage` + `useState`. Returns the latest pushed
value (or `initial` until the first message arrives).

```typescript
const hud = useNuiState<HudState>('hud.update', { hp: 100, armor: 0 })
return <div>HP: {hud.hp}</div>
```

### `useNuiCallback(channel)`

Returns a stable function that calls a NUI callback registered on the
client and resolves with the response.

```typescript
const buy = useNuiCallback<{ itemId: string }, { ok: boolean }>('shop.buy')

return <button onClick={() => buy({ itemId: 'water' })}>Buy</button>
```

### `useNuiRequest<T>(channel)`

Like `useNuiCallback`, but tracks `loading` / `data` / `error` /
`reset` for the request lifecycle. Useful for buttons that should
disable themselves while a request is pending.

```typescript
const { call, loading, data, error } = useNuiRequest<Offer[]>('shop.list')

useEffect(() => {
  call()
}, [call])

if (loading) return <Spinner />
if (error) return <Alert>{error.message}</Alert>
return <OfferList offers={data ?? []} />
```

### `useNuiBus()`

Read the `NuiBrowser` directly from the surrounding `<NuiProvider>`.
Throws a clear error if there is no provider in the tree.

```typescript
const bus = useNuiBus()
bus.on('custom-channel', /* ... */)
```

## Without a provider

Every hook accepts an optional `bus` argument as the last parameter so
tests (and apps that intentionally avoid the provider) can pass an
instance directly:

```typescript
const bus = new NuiBrowser({ resourceName: 'test' })
useNuiState('hud', { hp: 100 }, bus)
```

## Testing

The package ships with `jsdom` + Testing Library compatibility — see
the included tests for patterns. The bus itself is fully mockable
because `NuiBrowser` accepts overridden `window` + `fetch` in its
constructor.

## See also

- [`@nextvm/nui`](/packages/nui) — the underlying bus
- [`@nextvm/vite-plugin-nui`](/packages/vite-plugin-nui) — Vite-side defaults
- [`@nextvm/runtime-client`](/packages/runtime-client) — the client runtime that hosts NuiClient
