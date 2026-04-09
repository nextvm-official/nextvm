import {
	cancel,
	confirm,
	intro,
	isCancel,
	log,
	note,
	outro,
	select,
	text,
} from '@clack/prompts'
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
 * Two modes:
 *
 *   1. Non-interactive: pass project name + flags as args
 *      pnpm create nextvm@latest my-server --template starter
 *
 *   2. Interactive wizard: run with no args
 *      pnpm create nextvm@latest
 */

export type TemplateName = 'blank' | 'starter'

interface ParsedArgs {
	name: string | null
	template: TemplateName | null
	help: boolean
	version: boolean
	yes: boolean
}

const PKG_VERSION = '0.1.0'

const TEMPLATE_DESCRIPTIONS: Record<TemplateName, string> = {
	blank: 'Empty project — add your own modules from scratch',
	starter:
		'Working server: bootstrap + example shop module + every first-party module wired in',
}

function parseArgs(args: string[]): ParsedArgs {
	const result: ParsedArgs = {
		name: null,
		template: null,
		help: false,
		version: false,
		yes: false,
	}
	for (let i = 0; i < args.length; i++) {
		const arg = args[i]!
		if (arg === '--help' || arg === '-h') {
			result.help = true
		} else if (arg === '--version' || arg === '-v') {
			result.version = true
		} else if (arg === '--yes' || arg === '-y') {
			result.yes = true
		} else if (arg === '--template' || arg === '-t') {
			const next = args[i + 1]
			if (next === 'blank' || next === 'starter') {
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
${pc.bold(pc.cyan('▲ create-nextvm'))} ${pc.dim(`v${PKG_VERSION}`)}

${pc.dim('Scaffold a new NextVM server project.')}

${pc.bold('Usage:')}
  ${pc.cyan('pnpm create nextvm@latest')}                          ${pc.dim('# interactive wizard')}
  ${pc.cyan('pnpm create nextvm@latest')} ${pc.yellow('<project-name>')}           ${pc.dim('# blank template')}
  ${pc.cyan('pnpm create nextvm@latest')} ${pc.yellow('<project-name>')} ${pc.dim('--template starter')}

${pc.bold('Templates:')}
  ${pc.green('blank')}    ${TEMPLATE_DESCRIPTIONS.blank}
  ${pc.green('starter')}  ${TEMPLATE_DESCRIPTIONS.starter}

${pc.bold('Examples:')}
  ${pc.dim('$')} ${pc.cyan('pnpm create nextvm@latest my-server')}
  ${pc.dim('$')} ${pc.cyan('pnpm create nextvm@latest my-server --template starter')}
  ${pc.dim('$')} ${pc.cyan('pnpm create nextvm@latest')}             ${pc.dim('# guided setup')}

${pc.bold('Options:')}
  ${pc.dim('-t, --template <name>')}  Template to scaffold ${pc.dim('(blank | starter)')}
  ${pc.dim('-y, --yes')}              Skip prompts, accept all defaults
  ${pc.dim('-h, --help')}             Show this help
  ${pc.dim('-v, --version')}          Show version

${pc.dim('Documentation:')} ${pc.underline('https://docs.nextvm.dev')}
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

interface ResolvedConfig {
	name: string
	template: TemplateName
}

/**
 * Resolve project config from args + (optionally) interactive prompts.
 */
async function resolveConfig(args: ParsedArgs): Promise<ResolvedConfig> {
	// Path 1: fully specified, non-interactive
	if (args.name && args.template) {
		return { name: args.name, template: args.template }
	}

	// Path 2: yes-mode (CI / scripted)
	if (args.yes && args.name) {
		return { name: args.name, template: args.template ?? 'blank' }
	}

	// Path 3: backward-compat — name without template defaults to blank
	if (args.name && !args.template) {
		return { name: args.name, template: 'blank' }
	}

	// Path 4: full interactive wizard
	intro(`${pc.bgCyan(pc.black(' ▲ NextVM '))} ${pc.dim(`v${PKG_VERSION}`)}`)

	const projectName = await text({
		message: 'Project name',
		placeholder: 'my-fivem-server',
		validate: (value) => {
			if (!value) return 'Project name is required'
			if (!isValidProjectName(value)) {
				return 'Use lowercase letters, numbers, hyphens or underscores. Must start with a letter or number.'
			}
			if (existsSync(resolve(process.cwd(), value))) {
				return `Directory "${value}" already exists`
			}
			return undefined
		},
	})

	if (isCancel(projectName)) {
		cancel('Cancelled.')
		exit(0)
	}

	const template = await select<TemplateName>({
		message: 'Pick a template',
		options: [
			{
				value: 'starter',
				label: `${pc.bold('Starter')}${pc.dim('  — recommended')}`,
				hint: TEMPLATE_DESCRIPTIONS.starter,
			},
			{
				value: 'blank',
				label: pc.bold('Blank'),
				hint: TEMPLATE_DESCRIPTIONS.blank,
			},
		],
		initialValue: 'starter',
	})

	if (isCancel(template)) {
		cancel('Cancelled.')
		exit(0)
	}

	const proceed = await confirm({
		message: `Create ${pc.cyan(projectName as string)} with template ${pc.green(template as string)}?`,
		initialValue: true,
	})

	if (isCancel(proceed) || !proceed) {
		cancel('Cancelled.')
		exit(0)
	}

	return {
		name: projectName as string,
		template: template as TemplateName,
	}
}

async function scaffold(config: ResolvedConfig): Promise<void> {
	const target = resolve(process.cwd(), config.name)
	const displayName = basename(target)

	if (existsSync(target)) {
		log.error(`Directory ${pc.yellow(target)} already exists.`)
		exit(1)
	}

	await mkdir(target, { recursive: true })
	await mkdir(join(target, 'modules'), { recursive: true })

	const files =
		config.template === 'starter'
			? renderStarterTemplate(displayName)
			: renderBlankTemplate(displayName)

	await writeFiles(target, files)

	log.success(
		`Created ${pc.bold(pc.cyan(displayName))} ${pc.dim(`(${files.length} files, ${config.template} template)`)}`,
	)

	if (config.template === 'starter') {
		note(
			[
				`${pc.cyan('modules/core')}     Bootstrap module wiring everything together`,
				`${pc.cyan('modules/shop')}     Example custom module ${pc.dim('(router + service + tests)')}`,
				`${pc.dim('+ first-party:')}    banking, jobs, housing, inventory, player, vehicle`,
			].join('\n'),
			'What you got',
		)
	}

	const cmds = [
		`${pc.dim('$')} ${pc.cyan('cd')} ${displayName}`,
		`${pc.dim('$')} ${pc.cyan('pnpm install')}`,
		`${pc.dim('$')} ${pc.cyan('pnpm dev')}`,
	].join('\n')

	note(cmds, 'Next steps')

	if (config.template === 'blank') {
		log.message(
			`${pc.dim('Add your first module:')} ${pc.cyan('pnpm add:module')} ${pc.yellow('shop')} ${pc.dim('--full')}`,
		)
	}

	outro(`${pc.bold('Documentation:')} ${pc.underline('https://docs.nextvm.dev')}`)
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

	try {
		const config = await resolveConfig(args)
		await scaffold(config)
	} catch (err) {
		log.error(err instanceof Error ? err.message : String(err))
		exit(1)
	}
}

main()
