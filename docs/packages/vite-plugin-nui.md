# @nextvm/vite-plugin-nui

A Vite plugin that takes the friction out of building a NUI app for a
NextVM resource. Forces FiveM-compatible build settings, exposes a
virtual module with the resource name, prints the dev URL to use as
`ui_page`, and writes a `fxmanifest.nui.lua` snippet on production
builds.

## Install

```bash
pnpm add -D @nextvm/vite-plugin-nui vite
```

## Usage

In your NUI app's `vite.config.ts`:

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { nextvmNui } from '@nextvm/vite-plugin-nui'

export default defineConfig({
  plugins: [
    react(),
    nextvmNui({
      resourceName: 'my-server',
      uiDir: 'nui',
    }),
  ],
})
```

## What it does

### 1. FiveM-compatible defaults

The plugin forces:

- `base: './'` so NUI relative paths resolve correctly
- `build.sourcemap: false`
- `build.assetsInlineLimit: 0` (NUI can't load inlined data URIs reliably)
- `build.modulePreload.polyfill: false`

You can still override anything via your own `defineConfig` — the
plugin only sets defaults.

### 2. Virtual module `virtual:nextvm-nui`

NUI code can import:

```typescript
import { resourceName, NuiBrowser, devMode } from 'virtual:nextvm-nui'

const bus = new NuiBrowser({ resourceName })
```

The plugin resolves the import to a tiny ES module exposing the
resource name (no hardcoded strings) and re-exporting `NuiBrowser`
from [`@nextvm/nui`](/packages/nui).

### 3. Dev mode HMR URL

When you run `vite dev`, the plugin prints:

```
[nextvm-nui] Dev server ready. Set this as your fxmanifest ui_page in dev:
  ui_page 'http://localhost:5173/'
```

Set that URL as `ui_page` in your `fxmanifest.lua` while developing
and Vite's standard HMR will hot-reload your NUI without restarting
the resource.

### 4. Production fxmanifest snippet

On `vite build`, the plugin writes `fxmanifest.nui.lua` next to the
project root:

```lua
-- @nextvm/vite-plugin-nui
ui_page 'nui/index.html'
files {
	'nui/index.html',
	'nui/assets/index-abc123.js',
	'nui/assets/style-def456.css',
}
```

Reference it from your real `fxmanifest.lua`:

```lua
fx_version 'cerulean'
game 'gta5'

-- ... your client/server scripts ...

-- Generated NUI block
exec 'fxmanifest.nui.lua'
```

## Options

| Option | Default | Description |
|---|---|---|
| `resourceName` | basename of cwd | String embedded into the virtual module |
| `uiDir` | `'nui'` | Folder name inside the resource that holds the NUI bundle |
| `fxmanifestSnippetPath` | `'fxmanifest.nui.lua'` | Path the snippet is written to |
| `silent` | `false` | Suppress dev URL + write logs |
| `io` | (real fs) | Override fs/log/basename for unit tests |

## Testing

The plugin separates side effects via the `io` option so you can test
your wrapping in plain Node:

```typescript
import { nextvmNui } from '@nextvm/vite-plugin-nui'

const writes: Array<[string, string]> = []
const plugin = nextvmNui({
  resourceName: 'test',
  io: {
    writeFile: (p, c) => writes.push([p, c]),
    log: () => undefined,
    basename: (p) => p,
  },
})
plugin.config?.({}, { command: 'build', mode: 'production' })
plugin.writeBundle?.({ dir: 'dist' }, { 'index.html': { fileName: 'index.html' } })
expect(writes[0][0]).toBe('fxmanifest.nui.lua')
```

## See also

- [`@nextvm/nui`](/packages/nui) — typed bus the NUI app uses to talk to the client runtime
- [`@nextvm/runtime-client`](/packages/runtime-client) — the client runtime that hosts NuiClient
- [3](https://github.com/nextvm-official/nextvm/tree/main/docs/concept)
