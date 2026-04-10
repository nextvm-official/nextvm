import {
	cancel,
	confirm,
	intro,
	isCancel,
	log,
	note,
	outro,
	select,
	spinner,
	text,
} from '@clack/prompts'
import {
	cloneServerData,
	downloadFxserver,
	resolveRecommendedBuild,
	writeStoredBuild,
} from '@nextvm/fxserver-runner'
import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { basename, dirname, join, resolve } from 'node:path'
import { argv, exit, platform, stdout } from 'node:process'
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
	noFxserver: boolean
	fxserverPath: string | null
	fxserverData: string | null
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
		noFxserver: false,
		fxserverPath: null,
		fxserverData: null,
	}
	for (let i = 0; i < args.length; i++) {
		const arg = args[i]!
		if (arg === '--help' || arg === '-h') {
			result.help = true
		} else if (arg === '--version' || arg === '-v') {
			result.version = true
		} else if (arg === '--yes' || arg === '-y') {
			result.yes = true
		} else if (arg === '--no-fxserver') {
			result.noFxserver = true
		} else if (arg === '--fxserver-path') {
			result.fxserverPath = args[++i] ?? null
		} else if (arg === '--fxserver-data') {
			result.fxserverData = args[++i] ?? null
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

async function scaffold(config: ResolvedConfig, args: ParsedArgs): Promise<void> {
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

	// ── FXServer auto-bootstrap ──────────────────────────────
	const useExisting = args.fxserverPath !== null
	const skipFxserver = args.noFxserver

	if (!skipFxserver && config.template === 'starter') {
		if (useExisting) {
			// User has an existing FXServer install — point at it
			const envLines = [
				`FXSERVER_PATH=${args.fxserverPath}`,
				args.fxserverData ? `FXSERVER_DATA_PATH=${args.fxserverData}` : '',
				'CFX_LICENSE_KEY=',
			]
				.filter(Boolean)
				.join('\n')
			await writeFile(join(target, '.env'), `${envLines}\n`)
			log.success('Linked to existing FXServer installation')
		} else {
			// Auto-download FXServer + cfx-server-data
			const fxDir = join(target, '.fxserver')
			const artifactsDir = join(fxDir, 'artifacts')
			const dataDir = join(fxDir, 'data')

			const s = spinner()

			try {
				s.start('Resolving latest recommended FXServer build…')
				const build = await resolveRecommendedBuild(
					platform as 'win32' | 'linux',
				)
				s.stop(`Found FXServer build ${pc.cyan(build.build)}`)

				s.start(
					`Downloading FXServer (build ${build.build})… this may take a minute`,
				)
				await downloadFxserver(build.url, artifactsDir)
				writeStoredBuild(fxDir, build.build)
				s.stop('FXServer downloaded + extracted')

				s.start('Downloading cfx-server-data baseline…')
				await cloneServerData(dataDir)
				s.stop('cfx-server-data ready')
			} catch (err) {
				s.stop(
					pc.yellow(
						`FXServer download failed: ${err instanceof Error ? err.message : String(err)}`,
					),
				)
				log.warn(
					'You can download FXServer manually later, or re-run with --fxserver-path.',
				)
			}

			// Write .env with just the license key (paths are relative in config)
			await writeFile(
				join(target, '.env'),
				'# Cfx.re license key — get yours at https://keymaster.fivem.net\n# Without a key the server runs in offline mode (LAN only).\nCFX_LICENSE_KEY=\n',
			)
		}

		// License key prompt (interactive only)
		if (!args.yes) {
			const licenseKey = await text({
				message: 'Cfx.re License Key',
				placeholder: 'cfxk_… (press Enter to skip for offline mode)',
				defaultValue: '',
				validate: (value) => {
					if (value && !value.startsWith('cfxk_')) {
						return 'License keys start with cfxk_'
					}
					return undefined
				},
			})

			if (!isCancel(licenseKey) && licenseKey) {
				// Append to .env
				const envPath = join(target, '.env')
				const existing = existsSync(envPath)
					? (await import('node:fs')).readFileSync(envPath, 'utf-8')
					: ''
				const updated = existing.replace(
					'CFX_LICENSE_KEY=',
					`CFX_LICENSE_KEY=${licenseKey}`,
				)
				await writeFile(envPath, updated)
				log.success('License key saved to .env')
			} else {
				log.info(
					`${pc.dim('No key — server will run in offline mode.')} Get one at ${pc.underline('https://keymaster.fivem.net')}`,
				)
			}
		}
	}

	// ── Summary ──────────────────────────────────────────────
	if (config.template === 'starter') {
		note(
			[
				`${pc.cyan('modules/core')}     Bootstrap module wiring everything together`,
				`${pc.cyan('modules/shop')}     Example custom module ${pc.dim('(router + service + tests)')}`,
				useExisting || skipFxserver
					? ''
					: `${pc.cyan('.fxserver/')}       FXServer binary + cfx-server-data ${pc.dim('(gitignored)')}`,
				`${pc.dim('+ first-party:')}    banking, jobs, housing, inventory, player, vehicle`,
			]
				.filter(Boolean)
				.join('\n'),
			'What you got',
		)
	}

	const devCmd = config.template === 'starter' && !skipFxserver
		? 'pnpm nextvm dev --serve'
		: 'pnpm dev'

	const cmds = [
		`${pc.dim('$')} ${pc.cyan('cd')} ${displayName}`,
		`${pc.dim('$')} ${pc.cyan('pnpm install')}`,
		`${pc.dim('$')} ${pc.cyan(devCmd)}`,
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
		await scaffold(config, args)
	} catch (err) {
		log.error(err instanceof Error ? err.message : String(err))
		exit(1)
	}
}

main()
