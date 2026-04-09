# @nextvm/tebex

The single PLA-compliant payment integration for NextVM. Wraps the
Tebex Headless API and the Tebex webhook flow with type-safe Zod
schemas and HMAC-SHA256 signature verification.

[](/reference/pla) requires
every monetized module to ship through this package.

## Install

```bash
pnpm add @nextvm/tebex
```

## TebexClient

```typescript
import { TebexClient } from '@nextvm/tebex'

const tebex = new TebexClient({
  secret: process.env.TEBEX_SECRET!,
})

const pkg = await tebex.getPackage(12345)
// → { id, name, base_price, total_price, currency, ... }

const allPackages = await tebex.listPackages()
const tx = await tebex.getTransaction('tx_abc123')
const recent = await tebex.listRecentTransactions()
```

The client uses a pluggable `Fetcher` interface so tests can inject a
mock instead of stubbing global fetch:

```typescript
const tebex = new TebexClient({
  secret: 'sk_test',
  baseUrl: 'https://mock.tebex',
  fetcher: myMockFetcher,
})
```

## Webhook verification

```typescript
import { parseVerifiedWebhook, verifyTebexWebhook } from '@nextvm/tebex'

// Express-like handler
app.post('/tebex/webhook', async (req, res) => {
  const rawBody = req.rawBody
  const signature = req.headers['x-signature']
  const event = parseVerifiedWebhook(rawBody, signature, process.env.TEBEX_WEBHOOK_SECRET!)

  if (!event) return res.status(401).send('invalid signature')

  if (event.type === 'payment.completed') {
    await fulfillInGameItems(event.subject)
  }

  res.status(200).send('ok')
})
```

`verifyTebexWebhook` uses `timingSafeEqual` to avoid timing-oracle
attacks. `parseVerifiedWebhook` adds Zod validation on the payload —
if Tebex changes the API shape, you find out at parse time.

## Schemas

Every API response goes through a Zod schema before reaching your
code:

| Schema | Purpose |
|---|---|
| `tebexPackageSchema` | Single package + price + currency |
| `tebexTransactionSchema` | Transaction record with player + packages |
| `tebexWebhookPayloadSchema` | Webhook envelope with typed event types |
| `tebexPlayerSchema` | Player UUID + username |
| `tebexPriceSchema` | `{ amount, currency }` |

All schemas are `passthrough()` on unknown fields so the package
keeps working when Tebex extends the API.

## Webhook event types

```typescript
type TebexEventType =
  | 'payment.completed'
  | 'payment.refunded'
  | 'payment.chargeback'
  | 'recurring-payment.started'
  | 'recurring-payment.renewed'
  | 'recurring-payment.cancelled'
```

## MONETIZATION_TEMPLATE

The package exports a string template that monetized modules copy as
their `MONETIZATION.md`:

```typescript
import { MONETIZATION_TEMPLATE } from '@nextvm/tebex'
import { writeFileSync } from 'node:fs'

writeFileSync('MONETIZATION.md', MONETIZATION_TEMPLATE)
```

The template explains the PLA-compliant flow, the required Tebex
webhook configuration, the quarterly review schedule, and the
"never touch the money" rule.

## Tests

`packages/tebex/__tests__/` contains 12 tests covering webhook
signature verification, parsed-webhook validation, client request
shape, and schema mismatches against a mock fetcher.

## See also

- [PLA Compliance guide](/guide/pla-compliance)
- [](/reference/pla)
- [com/nextvm-official/nextvm/tree/main/docs/concept)
