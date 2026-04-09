/**
 * @nextvm/jobs — Phase 2 jobs module
 *
 * Concept v2.3, Chapter 8 + 18.
 *
 * Owns the job registry (police, ambulance, mechanic, taxi, ...),
 * tracks each character's current job + grade + on-duty status, and
 * pays salaries to on-duty characters via the banking module.
 *
 * Cross-module access (banking) goes through the BankingAdapter
 * interface (GUARD-002 — no direct import). Server-authoritative
 * writes (GUARD-003), Zod-validated RPC (GUARD-005), char-id scoped
 * (GUARD-011), i18n strings (GUARD-012).
 */

import { defineExports, defineModule, z } from '@nextvm/core'
import { JobRegistry } from './job-registry'
import { buildJobsRouter } from './router'
import { JobsService, type BankingAdapter } from './service'
import { jobsState } from './state'
import enLocale from './shared/locales/en'
import deLocale from './shared/locales/de'

/** Public service surface — consumed via inject<JobsExports>('jobs') */
export type JobsExports = ReturnType<typeof buildJobsExports>

function buildJobsExports(service: JobsService) {
	return defineExports({
		service,
		setJob: service.setJob.bind(service),
		setOnDuty: service.setOnDuty.bind(service),
		paySalaries: service.paySalaries.bind(service),
		getJob: service.getJob.bind(service),
	})
}

export default defineModule({
	name: 'jobs',
	version: '0.1.0',
	dependencies: ['player', 'banking'],

	config: z.object({
		salaryIntervalMinutes: z
			.number()
			.int()
			.min(1)
			.max(120)
			.default(10)
			.describe('Minutes between salary payouts to on-duty characters'),
	}),

	server: (ctx) => {
		const config = ctx.config as { salaryIntervalMinutes: number }
		const registry = new JobRegistry()

		// Seed the standard RP jobs so the module is usable out of the box
		registry.define({
			name: 'unemployed',
			label: 'Unemployed',
			type: 'civilian',
			grades: [{ level: 0, name: 'none', label: 'None', salary: 0 }],
		})
		registry.define({
			name: 'police',
			label: 'Police',
			type: 'leo',
			grades: [
				{ level: 0, name: 'recruit', label: 'Recruit', salary: 200 },
				{ level: 1, name: 'officer', label: 'Officer', salary: 300 },
				{ level: 2, name: 'sergeant', label: 'Sergeant', salary: 400 },
				{ level: 3, name: 'chief', label: 'Chief', salary: 600 },
			],
		})
		registry.define({
			name: 'ambulance',
			label: 'EMS',
			type: 'ems',
			grades: [
				{ level: 0, name: 'paramedic', label: 'Paramedic', salary: 250 },
				{ level: 1, name: 'doctor', label: 'Doctor', salary: 400 },
				{ level: 2, name: 'chief', label: 'Chief', salary: 600 },
			],
		})
		registry.define({
			name: 'mechanic',
			label: 'Mechanic',
			type: 'private',
			grades: [
				{ level: 0, name: 'apprentice', label: 'Apprentice', salary: 150 },
				{ level: 1, name: 'mechanic', label: 'Mechanic', salary: 250 },
				{ level: 2, name: 'owner', label: 'Owner', salary: 400 },
			],
		})

		const service = new JobsService(registry)
		const router = buildJobsRouter(service)

		// Pull the banking adapter via DI (Concept Chapter 8.2). Banking
		// is a declared dependency so its setExports() has already run.
		try {
			const banking = ctx.inject<{ addMoney: BankingAdapter['addMoney'] }>('banking')
			service.setBanking(banking)
		} catch {
			ctx.log.warn('banking module not available — salary payouts disabled')
		}

		// Publish the public surface
		ctx.setExports(buildJobsExports(service))
		ctx.exposeRouter(router)

		ctx.log.info('jobs module loaded (server)', {
			jobs: registry.all().length,
			procedures: Object.keys(router).length,
			salaryIntervalMinutes: config.salaryIntervalMinutes,
		})

		// Wire the salary tick — interval expressed in ms, LOW priority
		// because budget pressure should never starve actual gameplay
		ctx.onTick(
			() => {
				// Salary payout — best-effort. The active player list comes
				// from the runtime layer once we have a server-side player
				// service; for now this tick is a placeholder that runs at
				// the configured interval and emits an event modules can hook.
				ctx.events.emit('jobs:salaryTick', { intervalMin: config.salaryIntervalMinutes })
			},
			{
				interval: config.salaryIntervalMinutes * 60 * 1000,
				priority: 'LOW',
			},
		)

		ctx.onPlayerReady(async (player) => {
			// Initialize defaults
			jobsState.set(player.character.id, 'job', 'unemployed')
			jobsState.set(player.character.id, 'grade', 0)
			jobsState.set(player.character.id, 'onDuty', false)
		})

		ctx.onPlayerDropped(async (player) => {
			jobsState.clear(player.character.id)
		})
	},

	client: (ctx) => {
		ctx.log.info('jobs module loaded (client)')
	},

	shared: {
		constants: { locales: { en: enLocale, de: deLocale } },
	},
})

export { JobRegistry, defineJob } from './job-registry'
export type { JobDefinition, JobGrade } from './job-registry'
export { JobsService } from './service'
export type { BankingAdapter } from './service'
export { buildJobsRouter } from './router'
export { jobsState } from './state'
