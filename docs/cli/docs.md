# nextvm docs

Generate Markdown reference docs from every discovered module.

## Synopsis

```bash
nextvm docs [--out <dir>]
```

## Options

| Option | Default | Description |
|---|---|---|
| `--out <dir>` | `docs/modules` | Output directory |

## What it does

For every module in `modules/*`, the command emits a Markdown file
under `<out>/<short-name>.md` containing:

- Description (from `package.json`)
- Version
- Declared dependencies
- RPC procedures with names + types + Zod input shapes (regex parsed)
- Locale key lists (per locale)

The generated files are intentionally hand-readable so you can drop
them into a VitePress / Astro Starlight site, or commit them as
plain Markdown.

## Example

```bash
nextvm docs
```

```
ℹ Generating docs for 6 module(s)
✓ @nextvm/banking → docs/modules/banking.md
✓ @nextvm/housing → docs/modules/housing.md
✓ @nextvm/inventory → docs/modules/inventory.md
✓ @nextvm/jobs → docs/modules/jobs.md
✓ @nextvm/player → docs/modules/player.md
✓ @nextvm/vehicle → docs/modules/vehicle.md
✓ Wrote 6 doc file(s) to docs/modules/
```

## Sample output

```markdown
# @nextvm/banking

NextVM banking module — accounts, transfers, audit trail (Phase 2)

**Version:** 0.0.1

## Dependencies

- `player`

## RPC Procedures

| Name | Type | Input |
| --- | --- | --- |
| `getMyBalance` | `query` | _(none)_ |
| `transfer` | `mutation` | `z.object({ toCharId: z.number()... })` |

## Locales

### `en` (4 keys)
- `banking.transfer_success`
- `banking.transfer_failed`
- ...
```

## Limitations

- The RPC parser is regex-based — it handles the common
  `procedure.input(z.object({ ... }))` pattern but doesn't
  understand schemas built dynamically at runtime.
- For full TSDoc-rendered API references, drop the generated
  Markdown into a VitePress site (which is exactly what NextVM's
  own docs site does).

## See also

- [Concept Chapter 25 — Documentation](https://github.com/nextvm-official/nextvm/tree/main/docs/concept)
- [Modules section](/modules/player)
