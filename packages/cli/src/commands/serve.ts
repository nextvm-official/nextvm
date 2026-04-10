import { loadProject, runBuild } from '@nextvm/build'
import { FxserverRunner } from '@nextvm/fxserver-runner'
import type { Command } from 'commander'
import pc from 'picocolors'
import { cliLog } from '../utils/logger'

/**
 * `nextvm serve` — Spawn a local FXServer subprocess against the
 * built modules. Requires a `fxserver` block in nextvm.config.ts.
 *
 * Unlike `nextvm dev --serve`, this command does NOT watch for
 * source changes — it just boots FXServer once and streams logs.
 */
export function registerServeCommand(program: Command): void {
	program
		.command('serve')
		.description('Run a local FXServer against the built modules')
		.option('--no-build', 'Skip the build step (use existing dist/)')
		.action(async (opts: { build: boolean }) => {
			try {
				cliLog.banner('0.0.2', 'serve — local FXServer subprocess')

				const project = await loadProject()
				const fx = project.config.fxserver

				// Build modules first so FXServer loads fresh dist/. Same
				// rationale as `next start` requiring `next build`.
				if (opts.build !== false) {
					if (project.modules.length === 0) {
						cliLog.warn('No modules found — starting FXServer with no NextVM modules.')
					} else {
						cliLog.info(`Building ${project.modules.length} module(s)…`)
						const result = await runBuild(project, { verbose: false })
						if (result.errors.length > 0) {
							cliLog.error(`Build failed with ${result.errors.length} error(s).`)
							for (const e of result.errors) cliLog.plain(`  ${e}`)
							process.exit(1)
						}
						cliLog.success(`Built ${result.modules.length} module(s).`)
					}
				}
				if (!fx) {
					cliLog.error(
						'No `fxserver` block in nextvm.config.ts — cannot start FXServer.',
					)
					cliLog.plain(
						`${pc.dim('Add a fxserver { path: "..." } block to enable this command.')}`,
					)
					process.exit(1)
				}

				const runner = new FxserverRunner({
					fxserverPath: fx.path,
					fxserverDataPath: fx.dataPath,
					projectRoot: project.rootDir,
					modules: project.modules.map((m) => ({ name: m.name, path: m.path })),
					serverCfg: {
						hostname: project.config.server.name,
						maxClients: project.config.server.maxPlayers,
						endpoint: fx.endpoint,
						gameBuild: fx.gameBuild,
						licenseKey: fx.licenseKey ?? process.env.CFX_LICENSE_KEY,
						additionalResources: fx.additionalResources,
						convars: fx.convars,
					},
					onLog: (line, source) => {
						const tag = source === 'fxserver' ? pc.cyan('[fx]') : pc.dim('[runner]')
						cliLog.plain(`${tag} ${line}`)
					},
					onExit: (code) => {
						cliLog.warn(`FXServer exited (code ${code ?? 'null'})`)
						process.exit(code ?? 0)
					},
				})

				await runner.start()
				cliLog.success(`FXServer running (PID ${runner.getPid()})`)
				cliLog.dim('Press Ctrl+C to stop.')
				cliLog.br()

				const stop = async () => {
					cliLog.br()
					cliLog.info('Stopping FXServer…')
					await runner.stop()
					cliLog.success('Stopped cleanly.')
					process.exit(0)
				}
				process.on('SIGINT', stop)
				process.on('SIGTERM', stop)
			} catch (err) {
				cliLog.error(err instanceof Error ? err.message : String(err))
				process.exit(1)
			}
		})
}
