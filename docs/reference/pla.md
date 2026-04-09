# PLA Compliance Reference

NextVM is designed to comply with the
[Cfx.re Platform License Agreement (PLA)](https://forum.cfx.re/t/4571423).
This page summarizes what the PLA requires and how NextVM helps you stay
on the right side of it.

## What the PLA forbids

1. **Selling in-game advantages for real money.** Pay-to-win is out.
2. **Selling ESX/QBCore/NextVM itself, or any "core" framework.** Frameworks
   are infrastructure, not products.
3. **Charging for access to a server's content** (subscription paywalls
   that gate normal gameplay).
4. **Selling unlock keys, premium currencies, or boosts.**

## What the PLA allows

1. **Cosmetic-only paid content** (skins, vanity items, character slots).
2. **Donation perks** that are clearly cosmetic or convenience-only and
   don't affect competitive gameplay.
3. **Server hosting and operation costs** funded via donations or
   cosmetic shops.
4. **Patreon-style supporter tiers** as long as the rewards are cosmetic.

## How NextVM enforces this

### `@nextvm/tebex` — the only sanctioned payment integration

`@nextvm/tebex` ships with the official Tebex webhook handler with
HMAC-SHA256 verification. It exposes a typed event stream of completed
purchases — no SQL, no direct DB writes from a webhook.

###  — PLA-compliant payment flow

`nextvm validate` flags any module that:

- Imports a payment SDK other than `@nextvm/tebex`
- Writes directly to the player money table from a webhook handler
- Grants permissions or items based on a payment event without going
  through the cosmetic-grant API

### Module registry policy

`nextvm registry:publish` rejects modules whose `package.json`
declares `category: "p2w"` or whose description matches the PLA
blacklist patterns.

## Practical patterns

### Cosmetic shop (allowed)

```typescript
tebex.onPurchase(async (purchase) => {
  if (purchase.package === 'vip-hat') {
    await ctx.inject<InventoryAdapter>('inventory')
      .grantCosmetic(purchase.charId, 'hat_vip_gold');
  }
});
```

### Money grant (NOT allowed)

```typescript
// ✗  violation — pay-to-win
tebex.onPurchase(async (purchase) => {
  await db.query('UPDATE characters SET cash = cash + ? WHERE id = ?',
    [10000, purchase.charId]);
});
```

## See also

- [Cfx.re PLA full text](https://forum.cfx.re/t/4571423)
- [`@nextvm/tebex`](/packages/tebex) package reference
- [PLA Compliance Guide](/guide/pla-compliance)
