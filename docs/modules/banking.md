# @nextvm/banking

First-party banking module. Cash + bank accounts, atomic transfers
between characters with rollback on failure, audit-trail DB table.

## Install

```bash
pnpm add @nextvm/banking
```

```typescript
modules: ['@nextvm/banking']
```

## Dependencies

```typescript
dependencies: ['player']
```

## Config

| Field | Type | Default | Description |
|---|---|---|---|
| `startingCash` | int >= 0 | 500 | Cash given to a fresh character on first spawn |
| `startingBank` | int >= 0 | 2500 | Bank balance given to a fresh character on first spawn |

## DB table

The module ships an `initialMigration` that creates
`nextv_banking_transactions`:

```sql
CREATE TABLE nextv_banking_transactions (
  id          INT PRIMARY KEY AUTO_INCREMENT,
  fromCharId  INT NULL,
  toCharId    INT NULL,
  type        VARCHAR(20),    -- 'cash' | 'bank'
  amount      INT,
  reason      VARCHAR(255) NULL,
  createdAt   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## BankingExports

```typescript
import type { BankingExports } from '@nextvm/banking'

// In a consumer module's server():
const banking = ctx.inject<BankingExports>('banking')
await banking.transfer(fromCharId, toCharId, 'cash', 100, 'rent')
await banking.addMoney(charId, 'bank', 500, 'salary')
```

| Method | Signature |
|---|---|
| `service` | The full `BankingService` instance |
| `addMoney(charId, type, amount, reason?)` | Credit the account |
| `removeMoney(charId, type, amount, reason?)` | Debit the account, throws on `INSUFFICIENT_FUNDS` |
| `transfer(from, to, type, amount, reason?)` | Atomic transfer with rollback |
| `getBalance(charId)` | `{ cash, bank }` |

## RPC procedures

| Procedure | Type | Input | Auth |
|---|---|---|---|
| `getMyBalance` | query | — | self |
| `getBalance` | query | `{ charId }` | admin (intended) |
| `transfer` | mutation | `{ toCharId, type, amount, reason? }` | self |
| `addMoney` | mutation | `{ charId, type, amount, reason? }` | admin |
| `removeMoney` | mutation | `{ charId, type, amount, reason? }` | admin |

## Atomic transfers

`transfer()` is atomic: if the receiver fails (e.g. would overflow),
the sender is automatically refunded with `reason: 'rollback'`.
Self-transfers are rejected.

## PLA note

Banking handles **in-game money only**. No real-money flows touch
this module. Server operators who want to sell in-game currency
cannot do so via NextVM at all — see [PLA Compliance](/guide/pla-compliance).

## See also

- [`@nextvm/jobs`](/modules/jobs) consumes `BankingExports.addMoney` for salary payouts
- [`@nextvm/housing`](/modules/housing) consumes `BankingExports.removeMoney` for property purchases
