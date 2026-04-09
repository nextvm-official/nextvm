# PLA Compliance

The Cfx.re Creator Platform License Agreement (Creator PLA), updated
**January 12, 2026**, fundamentally changed how FiveM servers can
monetize. NextVM is built around this constraint from day one.

This page explains what the PLA permits, what it prohibits, and how
NextVM keeps your modules on the right side of the line.

## What the PLA prohibits

The Prohibited Methods section (3.1) of the Creator PLA bans:

- **Selling Virtual Items for real money.** Virtual Items are defined
  broadly: in-game currency, goods, items, boosts, effects, vehicles,
  skins, or any other virtual asset acquired via a digital storefront
  or earned in-game.
- **Selling in-game currency or loot boxes for real money.**
- **Cash-out mechanics** (players converting in-game value to real money).
- **Operating servers on behalf of third-party brands.**

The PLA requires that **all in-game monetization on FiveM servers
must be processed through Tebex**. This is non-negotiable.

## What the PLA permits

- **Selling scripts and developer tools to other developers.**
  This is what `@nextvm/registry` is for — it sells modules to server
  operators, never to players.
- **Hosting and infrastructure services.** Managed hosting is entirely
  outside the PLA's scope.
- **Developer tool subscriptions.** A premium CLI or SaaS dashboard
  is fine.
- **Tebex-mediated in-game item sales.** As long as the transaction
  flows through Tebex, the PLA is satisfied.

## How NextVM helps you stay compliant

### 1. NextVM does not process payments

There is no payment SDK in `@nextvm/core`. There is no money handler
in the framework. The only path to selling something to a player is
through `@nextvm/tebex`, which talks to Tebex's API directly.

### 2. `@nextvm/tebex` is the single bridge

Every monetized module imports `@nextvm/tebex` to:

- Verify Tebex webhook signatures (HMAC-SHA256 timing-safe-equal)
- Look up package metadata
- Look up transaction details
- Fulfill in-game items only after receiving a verified `payment.completed` webhook

The package never sees real money — Tebex handles the entire
transaction. NextVM just reacts to the webhook.

### 3. `nextvm validate` enforces 

If a module imports `@nextvm/tebex` and **does not** ship a
`MONETIZATION.md` file, `nextvm validate` fails with a hard error:

```
✗ Module 'weapon-shop' imports @nextvm/tebex but lacks MONETIZATION.md
```

The check looks for **real import statements**, not stray mentions
in JSDoc comments — so the test won't fire on a module that just
documents the policy without consuming the package.

### 4. The MONETIZATION.md template

`@nextvm/tebex` exports a `MONETIZATION_TEMPLATE` string that you can
copy verbatim as the starting point for your module's MONETIZATION.md:

```typescript
import { MONETIZATION_TEMPLATE } from '@nextvm/tebex'
import { writeFileSync } from 'node:fs'

writeFileSync('MONETIZATION.md', MONETIZATION_TEMPLATE)
```

The template covers:

- How the module routes payments through Tebex
- The required Tebex webhook configuration
- Why no in-game currency is sold for real money
- A quarterly review reminder (every Jan / Apr / Jul / Oct)

## What flows where

```
┌──────────────┐                     ┌────────────┐
│   Player     │ ── 1. real money ──▶│   Tebex    │
└──────────────┘                     └────────────┘
                                            │
                                            │ 2. payment.completed
                                            │    webhook
                                            ▼
                                   ┌──────────────────┐
                                   │ Your NextVM      │
                                   │ webhook handler  │
                                   └──────────────────┘
                                            │
                                            │ 3. parseVerifiedWebhook()
                                            │    → fulfill in-game item
                                            ▼
                                   ┌──────────────────┐
                                   │ inventory.addItem│
                                   │ via DI           │
                                   └──────────────────┘
```

NextVM and your module **never touch the money** — it stays inside
Tebex's payment flow. You receive a signed webhook, verify it, and
deliver an in-game item. That's the entire compliant pattern.

## Revenue streams that ARE PLA-compliant

| Stream | PLA status | NextVM support |
|---|---|---|
| Selling premium modules to developers | ✅ Compliant | `@nextvm/registry` |
| Managed hosting subscriptions | ✅ Compliant | |
| SaaS dashboard subscriptions | ✅ Compliant | |
| In-game item sales via Tebex | ✅ Compliant | `@nextvm/tebex` |
| In-game currency sales | ❌ Prohibited | NOT supported by design |
| Loot boxes | ❌ Prohibited | NOT supported |
| Cash-out mechanics | ❌ Prohibited | NOT supported |

## Quarterly review

The PLA can change. The framework reviews compliance on a quarterly
schedule (Jan / Apr / Jul / Oct). Every monetized module's
MONETIZATION.md should include the same review cadence.

If Tebex or Cfx.re publishes new terms, the framework's PLA reference
gets updated and the breaking change is called out in the release notes.

## See also

- [`@nextvm/tebex`](/packages/tebex) — the typed bridge
- [`@nextvm/registry`](/packages/registry) — developer-to-developer marketplace
- [](/reference/pla) — the rule itself
- [Cfx.re Creator PLA Reference](/reference/pla)
- [com/nextvm-official/nextvm/tree/main/docs/concept#4-cfxre-creator-pla--monetization-compliance)
