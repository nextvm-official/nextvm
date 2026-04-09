# @nextvm/jobs

First-party jobs module. Job registry with grades + salaries, on-duty
toggle, salary tick via the managed scheduler, banking integration via
the adapter pattern.

## Install

```bash
pnpm add @nextvm/jobs
```

```typescript
modules: ['@nextvm/jobs']
```

## Dependencies

```typescript
dependencies: ['player', 'banking']
```

## Config

| Field | Type | Default | Description |
|---|---|---|---|
| `salaryIntervalMinutes` | int (1–120) | 10 | Minutes between salary payouts to on-duty characters |

## Seeded jobs

The module seeds standard RP jobs on startup:

| Job | Type | Grades |
|---|---|---|
| `unemployed` | civilian | 1 (no salary) |
| `police` | leo | 4 (recruit → officer → sergeant → chief) |
| `ambulance` | ems | 3 (paramedic → doctor → chief) |
| `mechanic` | private | 3 (apprentice → mechanic → owner) |

Define more via `defineJob()`:

```typescript
import { defineJob, JobRegistry } from '@nextvm/jobs'

const registry = new JobRegistry()
registry.define(defineJob({
  name: 'taxi',
  label: 'Taxi',
  type: 'civilian',
  grades: [
    { level: 0, name: 'driver', label: 'Driver', salary: 100 },
    { level: 1, name: 'manager', label: 'Manager', salary: 200 },
  ],
}))
```

## State

`jobsState`:

| Field | Type | Default |
|---|---|---|
| `job` | string | `'unemployed'` |
| `grade` | int | 0 |
| `onDuty` | boolean | false |

## RPC procedures

| Procedure | Type | Input | Description |
|---|---|---|---|
| `getMyJob` | query | — | Returns the calling character's job + grade + duty status |
| `listJobs` | query | — | Returns every defined job + its grades |
| `setOnDuty` | mutation | `{ onDuty }` | Toggle on-duty status |
| `setJob` | mutation | `{ charId, jobName, grade }` | Admin: assign a job + grade |

## Adapter pattern

`@nextvm/jobs` consumes `@nextvm/banking` via the adapter pattern.
The interface is defined in the consumer (jobs), not the producer:

```typescript
// modules/jobs/src/adapters/banking-adapter.ts
export interface BankingAdapter {
  addMoney(
    charId: number,
    type: 'cash' | 'bank',
    amount: number,
    reason?: string,
  ): Promise<number>
}
```

The module pulls it via DI in `server()`:

```typescript
const banking = ctx.inject<BankingAdapter>('banking')
service.setBanking(banking)
```

This is the GUARD-002 escape hatch for cross-module deps —
[Dependency Injection concept](/concept/dependency-injection).

## Salary tick

Salaries are paid via the managed tick scheduler at LOW priority,
so budget pressure never starves actual gameplay:

```typescript
ctx.onTick(
  () => ctx.events.emit('jobs:salaryTick', { intervalMin }),
  { interval: salaryIntervalMinutes * 60 * 1000, priority: 'LOW' },
)
```

The salary payout itself goes through `JobsService.paySalaries()`
which iterates active on-duty characters and calls
`banking.addMoney(charId, 'bank', grade.salary, 'salary:police')`.

## JobsExports

```typescript
import type { JobsExports } from '@nextvm/jobs'

const jobs = ctx.inject<JobsExports>('jobs')
jobs.setJob(charId, 'police', 1)
const status = jobs.getJob(charId)
```

## See also

- [`@nextvm/banking`](/modules/banking)
- [Tick System](/concept/tick-system)
- [Dependency Injection](/concept/dependency-injection)
