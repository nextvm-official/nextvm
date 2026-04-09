import { loadProject } from '@nextvm/build'
import { Database, MySqlAdapter } from '@nextvm/db'
import {
	DbMigrationTarget,
	EsxMigrationSource,
	formatReport,
	QbCoreMigrationSource,
	runMigration,
	type MigrationSource,
} from '@nextvm/migration'
import type { Command } from 'commander'
import { cliLog } from '../utils/logger'

/**
 * `nextvm migrate:from <framework>` — Migrate from ESX or QBCore database.
 *
 * Concept v2.3, Chapter 16.2 + 17.
 *
 * Connects to the legacy DB using --host / --user / --password / --db
 * (or env vars), reads every player row, and writes them into the
 * NextVM target DB read from nextvm.config.ts.
 *
 * Always non-destructive against the source. Use --dry-run to inspect
 * the report without writing anything.
 */
export function registerMigrateFromCommand(program: Command): void {
	program
		.command('migrate:from <framework>')
		.description('Migrate from an existing framework database (esx, qbcore)')
		.option('--source-host <host>', 'Source DB host', 'localhost')
		.option('--source-port <port>', 'Source DB port', '3306')
		.option('--source-user <user>', 'Source DB user', 'root')
		.option('--source-password <password>', 'Source DB password', '')
		.option('--source-db <database>', 'Source DB database name')
		.option('--dry-run', 'Read + report without writing to the NextVM DB')
		.action(async (framework: string, opts: SourceOpts) => {
			if (framework !== 'esx' && framework !== 'qbcore') {
				cliLog.error(`Unknown framework: ${framework}. Supported: esx, qbcore`)
				process.exit(1)
			}
			if (!opts.sourceDb) {
				cliLog.error('--source-db is required')
				process.exit(1)
			}

			let sourceDb: Database | null = null
			let targetDb: Database | null = null
			try {
				cliLog.header(`Migrating from ${framework}`)

				// Load NextVM project (target connection)
				const project = await loadProject()
				targetDb = new Database(
					new MySqlAdapter({
						host: project.config.database.host,
						port: project.config.database.port,
						user: project.config.database.user,
						password: project.config.database.password,
						database: project.config.database.database,
					}),
				)

				// Connect to source DB
				sourceDb = new Database(
					new MySqlAdapter({
						host: opts.sourceHost,
						port: Number(opts.sourcePort),
						user: opts.sourceUser,
						password: opts.sourcePassword,
						database: opts.sourceDb,
					}),
				)

				const source: MigrationSource =
					framework === 'esx'
						? new EsxMigrationSource(sourceDb)
						: new QbCoreMigrationSource(sourceDb)
				const target = new DbMigrationTarget(targetDb)

				cliLog.step(opts.dryRun ? 'Dry run — no writes' : 'Running migration...')

				const report = await runMigration(source, target, {
					dryRun: opts.dryRun,
					onProgress: (cur, total) => {
						if (cur % 100 === 0 || cur === total) {
							cliLog.step(`Migrated ${cur}/${total}`)
						}
					},
				})

				console.log()
				console.log(formatReport(report))

				if (report.errors.length > 0) {
					cliLog.error(`Migration finished with ${report.errors.length} error(s)`)
					process.exit(1)
				}
				cliLog.success('Migration complete.')
			} catch (err) {
				cliLog.error(err instanceof Error ? err.message : String(err))
				process.exit(1)
			} finally {
				await sourceDb?.close().catch(() => {})
			}
		})
}

interface SourceOpts {
	sourceHost: string
	sourcePort: string
	sourceUser: string
	sourcePassword: string
	sourceDb?: string
	dryRun?: boolean
}
