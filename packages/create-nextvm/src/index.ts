import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { basename, join, resolve } from 'node:path'
import { argv, exit, stdout } from 'node:process'
import pc from 'picocolors'

/**
 * create-nextvm — scaffold a new NextVM project.
 *
 * Invoked via `pnpm create nextvm@latest <name>`,
 * `npm create nextvm@latest <name>`, or `yarn create nextvm <name>`.
 *
 * The package manager auto-strips its own arguments, so we just read
 * the rest of process.argv as the project name + flags.
 */

interface ParsedArgs {
	name: string | null
	help: boolean
	version: boolean
}

const PKG_VERSION = '0.0.1'
const NEXTVM_CLI_VERSION = '^0.0.2'
const NEXTVM_PKG_VERSION = '^0.0.2'

function parseArgs(args: string[]): ParsedArgs {
	const result: ParsedArgs = { name: null, help: false, version: false }
	for (const arg of args) {
		if (arg === '--help' || arg === '-h') result.help = true
		else if (arg === '--version' || arg === '-v') result.version = true
		else if (!arg.startsWith('-') && result.name === null) result.name = arg
	}
	return result
}

function printHelp(): void {
	stdout.write(`
${pc.bold('create-nextvm')} ${pc.dim(`v${PKG_VERSION}`)}

Scaffold a new NextVM server project.

${pc.bold('Usage:')}
  ${pc.cyan('pnpm create nextvm@latest')} ${pc.yellow('<project-name>')}
  ${pc.cyan('npm create nextvm@latest')} ${pc.yellow('<project-name>')}
  ${pc.cyan('yarn create nextvm')} ${pc.yellow('<project-name>')}

${pc.bold('Example:')}
  ${pc.cyan('pnpm create nextvm@latest my-fivem-server')}

${pc.bold('After scaffolding:')}
  ${pc.dim('cd my-fivem-server')}
  ${pc.dim('pnpm install')}
  ${pc.dim('pnpm dev')}

${pc.bold('Options:')}
  ${pc.dim('-h, --help')}     Show this help
  ${pc.dim('-v, --version')}  Show version

Documentation: ${pc.underline('https://docs.nextvm.dev')}
`)
}

function isValidProjectName(name: string): boolean {
	// npm package name rules: lowercase, no spaces, certain chars only
	return /^[a-z0-9][a-z0-9-_]*$/.test(name)
}

async function scaffold(projectName: string): Promise<void> {
	const target = resolve(process.cwd(), projectName)
	const displayName = basename(target)

	stdout.write(`\n${pc.bold(pc.cyan('▲ Creating NextVM project'))} ${pc.yellow(displayName)}\n\n`)

	if (existsSync(target)) {
		stdout.write(
			`${pc.red('✗')} Directory ${pc.yellow(target)} already exists.\n` +
				`  Pick a different name or remove the existing directory first.\n\n`,
		)
		exit(1)
	}

	await mkdir(target, { recursive: true })
	await mkdir(join(target, 'modules'), { recursive: true })

	// --- package.json ---
	const pkg = {
		name: displayName,
		version: '0.1.0',
		private: true,
		type: 'module',
		engines: { node: '>=22.0.0 <23.0.0' },
		scripts: {
			dev: 'nextvm dev',
			build: 'nextvm build',
			validate: 'nextvm validate',
			'add:module': 'nextvm add',
		},
		dependencies: {
			'@nextvm/core': NEXTVM_PKG_VERSION,
			'@nextvm/db': NEXTVM_PKG_VERSION,
			'@nextvm/i18n': NEXTVM_PKG_VERSION,
			'@nextvm/natives': NEXTVM_PKG_VERSION,
			'@nextvm/runtime-client': NEXTVM_PKG_VERSION,
			'@nextvm/runtime-server': NEXTVM_PKG_VERSION,
			zod: '^3.24.0',
		},
		devDependencies: {
			'@nextvm/cli': NEXTVM_CLI_VERSION,
			typescript: '^5.7.0',
		},
	}
	await writeFile(
		join(target, 'package.json'),
		`${JSON.stringify(pkg, null, 2)}\n`,
	)

	// --- tsconfig.json ---
	const tsconfig = {
		compilerOptions: {
			target: 'ES2022',
			module: 'ESNext',
			moduleResolution: 'bundler',
			strict: true,
			esModuleInterop: true,
			skipLibCheck: true,
			resolveJsonModule: true,
			isolatedModules: true,
			noUncheckedIndexedAccess: true,
		},
		include: ['modules', 'nextvm.config.ts'],
	}
	await writeFile(
		join(target, 'tsconfig.json'),
		`${JSON.stringify(tsconfig, null, 2)}\n`,
	)

	// --- nextvm.config.ts ---
	const nextvmConfig = `/**
 * NextVM project configuration.
 * Loaded by the CLI for build / dev / validate / migrate commands.
 */
export default {
	server: {
		name: ${JSON.stringify(displayName)},
		maxPlayers: 32,
		defaultLocale: 'en',
	},
	database: {
		host: process.env.MYSQL_HOST ?? 'localhost',
		port: 3306,
		user: process.env.MYSQL_USER ?? 'root',
		password: process.env.MYSQL_PASSWORD ?? '',
		database: process.env.MYSQL_DB ?? 'nextvm',
	},
	// Modules under modules/* are auto-discovered. List them explicitly
	// here to lock the build order or pin a subset.
	modules: [],
}
`
	await writeFile(join(target, 'nextvm.config.ts'), nextvmConfig)

	// --- .gitignore ---
	const gitignore = `node_modules/
dist/
.next/
.turbo/
.nextvm/
.env
.env.local
*.log
`
	await writeFile(join(target, '.gitignore'), gitignore)

	// --- README.md ---
	const readme = `# ${displayName}

A NextVM server project.

## Getting started

\`\`\`bash
pnpm install
pnpm dev
\`\`\`

## Useful commands

| Command | Description |
|---|---|
| \`pnpm dev\` | Watch + rebuild on file changes |
| \`pnpm build\` | Build all modules for production |
| \`pnpm validate\` | Static checks across all modules |
| \`pnpm add:module <name> --full\` | Scaffold a new module |

## Documentation

- [NextVM Docs](https://docs.nextvm.dev)
- [Getting Started Guide](https://docs.nextvm.dev/guide/end-to-end)
`
	await writeFile(join(target, 'README.md'), readme)

	// --- Done ---
	stdout.write(
		`${pc.green('✓')} Created ${pc.yellow(displayName)} at ${pc.dim(target)}\n\n` +
			`${pc.bold('Next steps:')}\n\n` +
			`  ${pc.dim('cd')} ${pc.cyan(displayName)}\n` +
			`  ${pc.dim('pnpm install')}\n` +
			`  ${pc.dim('pnpm dev')}\n\n` +
			`${pc.bold('Add your first module:')}\n\n` +
			`  ${pc.dim('pnpm add:module')} ${pc.yellow('shop')} ${pc.dim('--full')}\n\n` +
			`${pc.bold('Documentation:')} ${pc.underline('https://docs.nextvm.dev')}\n\n`,
	)
}

async function main(): Promise<void> {
	const args = parseArgs(argv.slice(2))

	if (args.help) {
		printHelp()
		return
	}
	if (args.version) {
		stdout.write(`create-nextvm v${PKG_VERSION}\n`)
		return
	}
	if (!args.name) {
		stdout.write(
			`${pc.red('✗')} Missing project name.\n\n` +
				`Usage: ${pc.cyan('pnpm create nextvm@latest')} ${pc.yellow('<project-name>')}\n\n` +
				`Run ${pc.cyan('pnpm create nextvm@latest --help')} for more info.\n`,
		)
		exit(1)
	}
	if (!isValidProjectName(args.name)) {
		stdout.write(
			`${pc.red('✗')} Invalid project name: ${pc.yellow(args.name)}\n` +
				`  Project names must be lowercase letters, numbers, hyphens, or underscores,\n` +
				`  and start with a letter or number.\n`,
		)
		exit(1)
	}

	try {
		await scaffold(args.name)
	} catch (err) {
		stdout.write(
			`\n${pc.red('✗ Scaffold failed:')} ${err instanceof Error ? err.message : String(err)}\n`,
		)
		exit(1)
	}
}

main()
