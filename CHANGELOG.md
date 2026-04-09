# Changelog

All notable changes to NextVM are documented in this file.

This project uses [Changesets](https://github.com/changesets/changesets)
to manage versions and changelogs. Releases are published automatically
when a release PR is merged.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and the project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

Initial public release in preparation. The framework has reached
feature-completeness for Phases 0 through 4 of the concept document:

- Foundation: `@nextvm/core`, `@nextvm/natives`, `@nextvm/i18n`
- Core extensions: RPC, State, Permissions, DB, CLI, Discord, Compat
- Game modules: banking, jobs, housing, inventory, player, vehicle
- Tooling: build pipeline, dev orchestrator, validate, migrate
- Runtime: server bootstrap, client bootstrap, NUI bus + React hooks,
  Voice service, Vite plugin
- Polish: state hot-reload across `ensure` restarts, live ensure-restart
  bridge from `nextvm dev`

See [`docs/`](./docs/) for the full feature reference.
