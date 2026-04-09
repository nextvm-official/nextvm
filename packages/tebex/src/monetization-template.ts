/**
 * MONETIZATION.md template — every module that consumes @nextvm/tebex
 * must ship one of these.
 *
 * Concept v2.3, Chapter 4.4 (PLA compliance documentation):
 *   "Every module that touches player-facing monetization must include
 *    a MONETIZATION.md file explaining how it complies with the PLA.
 *    The CLI's nextvm validate step will check for this file in
 *    relevant modules."
 *
 * Exporting it as a string lets `nextvm add --monetized` write it
 * out next to a fresh module without needing a separate template file.
 */

export const MONETIZATION_TEMPLATE = `# Monetization

This module sells in-game items to players. Per the Cfx.re Creator
PLA (January 2026), in-game item sales must be processed through
Tebex — they cannot be processed by NextVM directly.

## How this module is PLA-compliant

- All real-money transactions are routed through @nextvm/tebex.
- The webhook handler verifies signatures via verifyTebexWebhook().
- The fulfillment path is server-authoritative — clients never decide
  what they receive.
- No in-game currency is sold for real money.
- No loot boxes.
- No cash-out mechanics.

## Where the money flows

1. Player buys a Tebex package on the server's Tebex storefront.
2. Tebex sends a payment.completed webhook to the server.
3. The server verifies the webhook signature.
4. The server fulfills the package by giving the player the in-game
   item via the relevant module's API (e.g. inventory.addItem()).
5. NextVM and the module author never touch the money — it stays
   inside Tebex's payment flow.

## Tebex configuration

| Setting | Value |
| --- | --- |
| Webhook URL | https://your-server.example/tebex/webhook |
| Webhook secret | (set TEBEX_WEBHOOK_SECRET in your env) |
| Required scopes | packages:read, payments:read |

## Quarterly review

Per .ai/PLA_COMPLIANCE.md, this file must be reviewed every quarter
(Jan / Apr / Jul / Oct) to confirm Tebex API + PLA terms have not
shifted. Note any changes in this section.

Last reviewed: TODO — set when first deployed
`
