import { loadProject } from '@nextvm/build'
import {
	Database,
	initialCharacterMigration,
	MigrationRunner,
	MySqlAdapter,
} from '@nextvm/db'
import type { Command } from 'commander'
import { cliLog } from '../utils/logger'
import { notImplemented } from '../utils/not-implemented'

/**
 * `nextvm db:*` — Database commands.
 *
 * Concept v2.3, Chapter 12 + 17.
 *
 * The runtime side (MigrationRunner) is in @nextvm/db. These commands
 * load the project's nextvm.config.ts, instantiate a MySqlAdapter from
 * the configured connection, register the framework migrations
 * (currently just initialCharacterMigration — modules can register more
 * via their own bootstrap once the project loader supports migrations),
 * and run the requested action.
 */

async function buildRunner() {
	const project = await loadProject()
	const adapter = new MySqlAdapter({
		host: project.config.database.host,
		port: project.config.database.port,
		user: project.config.database.user,
		password: project.config.database.password,
		database: project.config.database.database,
	})
	const db = new Database(adapter)
	const runner = new MigrationRunner(db)
	// Framework migrations always run first
	runner.add(initialCharacterMigration)
	return { db, runner }
}

export function registerDbCommands(program: Command): void {
	const db = program.command('db').description('Database utilities (Concept Chapter 12)')

	db.command('generate')
		.description('Generate a migration from a schema diff')
		.action(() => {
			notImplemented(
				'db:generate',
				'Schema diff requires a per-project module-state walker. Lands later in Phase 2.',
			)
		})

	db.command('migrate')
		.description('Apply pending migrations')
		.action(async () => {
			try {
				cliLog.header('db:migrate')
				const { db, runner } = await buildRunner()
				const pending = await runner.getPending()
				if (pending.length === 0) {
					cliLog.success('Database is up to date.')
				} else {
					cliLog.step(`Applying ${pending.length} migration(s)...`)
					const applied = await runner.migrate()
					for (const name of applied) cliLog.success(`applied ${name}`)
				}
				await db.close()
			} catch (err) {
				cliLog.error(err instanceof Error ? err.message : String(err))
				process.exit(1)
			}
		})

	db.command('rollback')
		.description('Roll back the most recent migration')
		.option('-n, --steps <count>', 'Number of migrations to roll back', '1')
		.action(async (opts: { steps?: string }) => {
			try {
				const steps = Number(opts.steps ?? '1')
				cliLog.header(`db:rollback (${steps} step${steps === 1 ? '' : 's'})`)
				const { db, runner } = await buildRunner()
				const rolled = await runner.rollback(steps)
				if (rolled.length === 0) {
					cliLog.warn('Nothing to roll back.')
				} else {
					for (const name of rolled) cliLog.success(`rolled back ${name}`)
				}
				await db.close()
			} catch (err) {
				cliLog.error(err instanceof Error ? err.message : String(err))
				process.exit(1)
			}
		})

	db.command('seed')
		.description('Run database seed scripts')
		.action(() => {
			notImplemented(
				'db:seed',
				'Seed runner needs a per-project seed registry. Lands together with the project module bootstrap.',
			)
		})
}
