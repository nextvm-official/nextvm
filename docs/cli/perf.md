# nextvm perf

Inspect runtime profiler output captured by the NextVM profiler.

## Synopsis

```bash
nextvm perf report [--input <path>] [--top <n>]
nextvm perf clear  [--input <path>]
```

## perf report

Reads a profiler dump file and prints the slowest ticks + RPCs.

| Option | Default | Description |
|---|---|---|
| `--input <path>` | `.nextvm/profiler.json` | Profiler dump file |
| `--top <n>` | `10` | How many entries to show per section |

### What it does

The runtime profiler (wired into `TickScheduler` and `RpcRouter`) records:

- Tick handler durations per module + priority
- RPC procedure durations per router
- Error counts from the `ErrorBoundary`

`nextvm perf report` formats this into a readable table so you can spot
hot paths without spinning up an external observability stack.

### Example

```bash
nextvm perf report --top 5
```

```
ℹ Reading .nextvm/profiler.json (captured 2026-04-07T10:30:00Z)

Top 5 ticks (by avg duration)
  banking.audit          HIGH    8.4ms avg   42 calls   max 14ms
  housing.rentSweep      LOW     6.1ms avg    7 calls   max 9ms
  jobs.payroll           MEDIUM  3.9ms avg   12 calls   max 6ms
  vehicle.fuelDrain      LOW     1.2ms avg  120 calls   max 2ms
  player.savePosition    MEDIUM  0.8ms avg  600 calls   max 2ms

Top 5 RPCs (by avg duration)
  banking.transfer       12.3ms avg   84 calls   max 41ms
  housing.purchase        9.8ms avg   12 calls   max 22ms
  jobs.applyForJob        4.1ms avg   31 calls   max 7ms
  inventory.giveItem      2.2ms avg  240 calls   max 5ms
  player.getProfile       0.6ms avg  812 calls   max 2ms

Errors (last hour)
  banking.audit          2 errors   (boundary OPEN: no)
  housing.rentSweep      1 error    (boundary OPEN: no)
```

## perf clear

Wipes the profiler dump file. Useful between benchmark runs.

```bash
nextvm perf clear
```

```
✓ Cleared .nextvm/profiler.json
```

## See also

- [Tick System](/concept/tick-system)
- [Error Boundaries](/concept/error-boundaries)
- [com/nextvm-official/nextvm/tree/main/docs/concept)
