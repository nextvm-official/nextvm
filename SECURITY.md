# Security Policy

## Supported Versions

NextVM is currently in active development. We support the latest
released version on the `main` branch. Older versions do not receive
security fixes — please upgrade.

## Reporting an Issue

If you discover a security issue in NextVM, please **do not open a
public GitHub issue**. Instead, report it privately so we can fix it
before it becomes public knowledge.

**Preferred channel — GitHub Security Advisories.** Go to the repo's
[Security tab → Advisories → Report a vulnerability](https://github.com/nextvm-official/nextvm/security/advisories/new).
This creates a private advisory only the maintainers can see.

Please include:

- A clear description of the issue
- Steps to reproduce, or a minimal proof-of-concept
- The affected NextVM version and the environment (Node version,
  FXServer version)
- Any suggested mitigation if you have one

## What to Expect

- We aim to acknowledge reports within 72 hours.
- We will keep you informed about our progress.
- We will credit you in the eventual advisory unless you prefer to
  remain anonymous.

## Scope

In scope:
- Anything inside `packages/*` and `modules/*`
- The CLI (`@nextvm/cli`)
- The runtime layer (`@nextvm/runtime-server`, `@nextvm/runtime-client`)
- The example projects under `examples/`

Out of scope:
- Misconfiguration of a downstream FXServer
- Issues in third-party FiveM resources that NextVM does not ship
- Issues in `pma-voice`, `txAdmin`, or other upstream tools

## Hall of Fame

Reporters who have helped improve NextVM's security will be listed
here once we have any to thank.
