import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { basename, dirname, join, resolve } from 'node:path'
import { argv, exit, stdout } from 'node:process'
import pc from 'picocolors'
import { renderBlankTemplate } from './templates/blank'
import { renderStarterTemplate } from './templates/starter'

/**
 * create-nextvm — scaffold a new NextVM server project.
 *
 * Invoked via `pnpm create nextvm@latest <name>`,
 * `npm create nextvm@latest <name>`, or `yarn create nextvm <name>`.
 *
 * The package manager auto-strips its own arguments, so we just read
 * the rest of process.argv as the project name + flags.
 */

export type TemplateName = 'blank' | 'starter'

interface ParsedArgs {
	name: string | null
	template: TemplateName
	help: boolean
	version: boolean
}

const PKG_VERSION = '0.1.0'

const TEMPLATE_DESCRIPTIONS: Record<TemplateName, string> = {
	blank: 'Empty NextVM project — no modules, no bootstrap (default)',
	starter:
		'Working server: bootstrap module + example shop module + all first-party modules wired in',
}

function parseArgs(args: string[]): ParsedArgs {
	const result: ParsedArgs = {
		name: null,
		template: 'blank',
		help: false,
		version: false,
	}
	for (let i = 0; i < args.length; i++) {
		const arg = args[i]!
		if (arg === '--help' || arg === '-h') {
			result.help = true
		} else if (arg === '--version' || arg === '-v') {
			result.version = true
		} else if (arg === '--template' || arg === '-t') {
			const next = args[i + 1]
			if (next && (next === 'blank' || next === 'starter')) {
				result.template = next
				i++
			}
		} else if (arg.startsWith('--template=')) {
			const value = arg.slice('--template='.length)
			if (value === 'blank' || value === 'starter') {
				result.template = value
			}
		} else if (!arg.startsWith('-') && result.name === null) {
			result.name = arg
		}
	}
	return result
}

function printHelp(): void {
	stdout.write(`
${pc.bold('create-nextvm')} ${pc.dim(`v${PKG_VERSION}`)}

Scaffold a new NextVM server project.

${pc.bold('Usage:')}
  ${pc.cyan('pnpm create nextvm@latest')} ${pc.yellow('<project-name>')} ${pc.dim('[--template <name>]')}
  ${pc.cyan('npm create nextvm@latest')}  ${pc.yellow('<project-name>')} ${pc.dim('[--template <name>]')}
  ${pc.cyan('yarn create nextvm')}        ${pc.yellow('<project-name>')} ${pc.dim('[--template <name>]')}

${pc.bold('Templates:')}
  ${pc.green('blank')}    ${TEMPLATE_DESCRIPTIONS.blank}
  ${pc.green('starter')}  ${TEMPLATE_DESCRIPTIONS.starter}

${pc.bold('Examples:')}
  ${pc.cyan('pnpm create nextvm@latest my-server')}
  ${pc.cyan('pnpm create nextvm@latest my-server --template starter')}

${pc.bold('After scaffolding:')}
  ${pc.dim('cd my-server')}
  ${pc.dim('pnpm install')}
  ${pc.dim('pnpm dev')}

${pc.bold('Options:')}
  ${pc.dim('-t, --template <name>')}  Template to scaffold (default: blank)
  ${pc.dim('-h, --help')}             Show this help
  ${pc.dim('-v, --version')}          Show version

Documentation: ${pc.underline('https://docs.nextvm.dev')}
`)
}

function isValidProjectName(name: string): boolean {
	return /^[a-z0-9][a-z0-9-_]*$/.test(name)
}

export interface FileEntry {
	path: string
	contents: string
}

async function writeFiles(targetRoot: string, files: FileEntry[]): Promise<void> {
	for (const file of files) {
		const fullPath = join(targetRoot, file.path)
		const dir = dirname(fullPath)
		await mkdir(dir, { recursive: true })
		await writeFile(fullPath, file.contents)
	}
}

async function scaffold(projectName: string, template: TemplateName): Promise<void> {
	const target = resolve(process.cwd(), projectName)
	const displayName = basename(target)

	stdout.write(
		`\n${pc.bold(pc.cyan('▲ Creating NextVM project'))} ${pc.yellow(displayName)} ` +
			`${pc.dim(`(template: ${template})`)}\n\n`,
	)

	if (existsSync(target)) {
		stdout.write(
			`${pc.red('✗')} Directory ${pc.yellow(target)} already exists.\n` +
				`  Pick a different name or remove the existing directory first.\n\n`,
		)
		exit(1)
	}

	await mkdir(target, { recursive: true })
	await mkdir(join(target, 'modules'), { recursive: true })

	const files =
		template === 'starter'
			? renderStarterTemplate(displayName)
			: renderBlankTemplate(displayName)

	await writeFiles(target, files)

	const fileCount = files.length
	stdout.write(
		`${pc.green('✓')} Created ${pc.yellow(displayName)} ${pc.dim(`(${fileCount} files)`)} at ${pc.dim(target)}\n\n`,
	)

	if (template === 'starter') {
		stdout.write(
			`${pc.bold('What you got:')}\n\n` +
				`  • ${pc.cyan('modules/core')}    Bootstrap module wiring everything together\n` +
				`  • ${pc.cyan('modules/shop')}    Example module with router, service, tests\n` +
				`  • All first-party modules ${pc.dim('(banking, jobs, housing, inventory, player, vehicle)')}\n\n`,
		)
	}

	stdout.write(
		`${pc.bold('Next steps:')}\n\n` +
			`  ${pc.dim('cd')} ${pc.cyan(displayName)}\n` +
			`  ${pc.dim('pnpm install')}\n` +
			`  ${pc.dim('pnpm dev')}\n\n`,
	)

	if (template === 'blank') {
		stdout.write(
			`${pc.bold('Add your first module:')}\n\n` +
				`  ${pc.dim('pnpm add:module')} ${pc.yellow('shop')} ${pc.dim('--full')}\n\n` +
				`${pc.bold('Or start with the working starter template instead:')}\n\n` +
				`  ${pc.cyan('pnpm create nextvm@latest')} ${pc.yellow(`${displayName}-starter`)} ${pc.dim('--template starter')}\n\n`,
		)
	}

	stdout.write(`${pc.bold('Documentation:')} ${pc.underline('https://docs.nextvm.dev')}\n\n`)
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
				`Usage: ${pc.cyan('pnpm create nextvm@latest')} ${pc.yellow('<project-name>')} ${pc.dim('[--template <name>]')}\n\n` +
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
		await scaffold(args.name, args.template)
	} catch (err) {
		stdout.write(
			`\n${pc.red('✗ Scaffold failed:')} ${err instanceof Error ? err.message : String(err)}\n`,
		)
		exit(1)
	}
}

main()
