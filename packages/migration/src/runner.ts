import type {
	LegacyPlayer,
	MigrationOptions,
	MigrationReport,
	MigrationSource,
	MigrationTarget,
	MigrationWarning,
} from './types'

/**
 * Run a full source → target migration.
 *   1. Read every legacy player row
 *   2. Map identifiers (license / steam / discord)
 *   3. Convert money fields to NextVM character fields
 *   4. Migrate inventory (JSON conversion)
 *   5. Create NextVM character records
 *   6. Emit a typed report with warnings
 * Always non-destructive against the source — the toolkit only reads.
 * The caller is responsible for backups before running.
 */
export async function runMigration(
	source: MigrationSource,
	target: MigrationTarget,
	options: MigrationOptions = {},
): Promise<MigrationReport> {
	const startedAt = new Date()
	const report: MigrationReport = {
		framework: source.framework,
		startedAt,
		finishedAt: startedAt,
		dryRun: options.dryRun ?? false,
		totalRowsRead: 0,
		usersInserted: 0,
		charactersInserted: 0,
		skipped: 0,
		warnings: [],
		errors: [],
	}

	const total = await source.count()

	for await (const row of source.listPlayers()) {
		report.totalRowsRead++

		const issues = validatePlayer(row)
		if (issues.length > 0) {
			if (options.skipMalformed ?? true) {
				report.skipped++
				for (const i of issues) report.warnings.push({ identifier: row.identifier, message: i })
				options.onProgress?.(report.totalRowsRead, total)
				continue
			}
			report.errors.push({ identifier: row.identifier, message: issues.join('; ') })
			options.onProgress?.(report.totalRowsRead, total)
			continue
		}

		try {
			if (!options.dryRun) {
				const license = normalizeLicense(row.identifier)
				const user = await target.insertUser({
					license,
					discord: row.discord,
					steam: row.steam,
				})
				await target.insertCharacter({
					userId: user.id,
					slot: 1,
					firstName: row.firstName,
					lastName: row.lastName,
					dateOfBirth: row.dateOfBirth,
					gender: row.gender,
					cash: row.cash,
					bank: row.bank,
					job: row.job,
					position: row.position,
					inventoryJson: JSON.stringify(row.inventory ?? []),
					metadataJson: JSON.stringify({
						vehicles: row.vehicles ?? [],
						jobGrade: row.jobGrade,
					}),
				})
			}
			report.usersInserted++
			report.charactersInserted++
		} catch (err) {
			report.errors.push({
				identifier: row.identifier,
				message: err instanceof Error ? err.message : String(err),
				stack: err instanceof Error ? err.stack : undefined,
			})
		}

		options.onProgress?.(report.totalRowsRead, total)
	}

	if (source.close) await source.close()
	if (target.close) await target.close()

	report.finishedAt = new Date()
	return report
}

/**
 * Validate a legacy player row before we touch the target.
 * Returns a list of warning messages — empty when the row is good.
 */
function validatePlayer(player: LegacyPlayer): string[] {
	const issues: string[] = []
	if (!player.identifier) issues.push('missing identifier')
	if (!player.firstName) issues.push('missing firstName')
	if (!player.lastName) issues.push('missing lastName')
	if (typeof player.cash !== 'number' || Number.isNaN(player.cash))
		issues.push('cash is not a number')
	if (typeof player.bank !== 'number' || Number.isNaN(player.bank))
		issues.push('bank is not a number')
	return issues
}

/**
 * Normalize a legacy identifier into a NextVM license string.
 * ESX uses `license:abc...`, QBCore uses raw `abc...` or `license:abc...`.
 * We strip a leading `license:` if present and prefix with `license:`
 * unconditionally so the resulting NextVM user.license is canonical.
 */
function normalizeLicense(raw: string): string {
	const trimmed = raw.replace(/^license:/, '')
	return `license:${trimmed}`
}

/**
 * Render a human-readable summary of a migration report.
 * The CLI prints this; tests assert on the structured fields directly.
 */
export function formatReport(report: MigrationReport): string {
	const durationMs = report.finishedAt.getTime() - report.startedAt.getTime()
	const lines: string[] = []
	lines.push(`Migration from ${report.framework} ${report.dryRun ? '(dry run)' : ''}`)
	lines.push(`  Started:    ${report.startedAt.toISOString()}`)
	lines.push(`  Finished:   ${report.finishedAt.toISOString()}`)
	lines.push(`  Duration:   ${durationMs}ms`)
	lines.push(`  Rows read:  ${report.totalRowsRead}`)
	lines.push(`  Users:      ${report.usersInserted}`)
	lines.push(`  Characters: ${report.charactersInserted}`)
	lines.push(`  Skipped:    ${report.skipped}`)
	lines.push(`  Warnings:   ${report.warnings.length}`)
	lines.push(`  Errors:     ${report.errors.length}`)

	if (report.warnings.length > 0) {
		lines.push('')
		lines.push('Warnings:')
		for (const w of report.warnings.slice(0, 20)) {
			lines.push(`  - [${w.identifier ?? 'unknown'}] ${w.message}`)
		}
		if (report.warnings.length > 20) {
			lines.push(`  ... and ${report.warnings.length - 20} more`)
		}
	}

	if (report.errors.length > 0) {
		lines.push('')
		lines.push('Errors:')
		for (const e of report.errors.slice(0, 20)) {
			lines.push(`  - [${e.identifier ?? 'unknown'}] ${e.message}`)
		}
		if (report.errors.length > 20) {
			lines.push(`  ... and ${report.errors.length - 20} more`)
		}
	}

	return lines.join('\n')
}

export type { MigrationWarning }
