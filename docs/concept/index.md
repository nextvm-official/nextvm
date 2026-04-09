# Concept Overview

The Concept section maps NextVM's framework v2.3 specification onto
the implemented code. Each chapter is a self-contained reference for
one architectural concern.

If you're looking for **how to use a feature**, the [Guide](/guide/getting-started)
is usually the better starting point. If you're looking for **why
NextVM is built this way**, this section is the answer.

## Reading order

If you're new to NextVM, read in this order:

1. [Module System](/concept/module-system) — what a module IS
2. [Dependency Injection](/concept/dependency-injection) — how modules wire together
3. [Character System](/concept/character-system) — User vs Character
4. [State Management](/concept/state-management) — character-scoped reactive state
5. [RPC](/concept/rpc) — type-safe client/server calls
6. [Permissions](/concept/permissions) — RBAC on FiveM ACE
7. [i18n](/concept/i18n) — typed translation keys
8. [Tick System](/concept/tick-system) — managed frame budget
9. [Error Boundaries](/concept/error-boundaries) — module degradation
10. [Compatibility Layer](/concept/compatibility-layer) — ESX/QBCore coexistence

## Architecture principles

The whole framework is shaped by eight core principles
([Concept Ch. 5.2](https://github.com/nextvm-official/nextvm/tree/main/docs/concept)):

1. **Dependency Inversion** — modules depend on abstractions
2. **Single Responsibility** — one domain per module
3. **Event-Driven** — typed event bus, not direct imports
4. **Config-as-Code** — Zod schemas validated at startup
5. **Zero Global State** — instance state only
6. **Build-Time Safety** — TS + Zod + CLI validate before runtime
7. **Schema-Driven** — Zod schemas as single source of truth
8. **PLA-Aware** — Tebex bridge for monetization

Each principle is enforced by one or more

