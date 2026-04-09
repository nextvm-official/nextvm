import { defineRouter, procedure, RpcError, z } from '@nextvm/core'
import type { JobsService } from './service'

export function buildJobsRouter(service: JobsService) {
	return defineRouter({
		/** Get the calling player's current job */
		getMyJob: procedure.query(({ ctx }) => {
			if (!ctx.charId) throw new RpcError('NOT_FOUND', 'No active character')
			return service.getJob(ctx.charId)
		}),

		/** List all defined jobs (with grades) */
		listJobs: procedure.query(() => service.getRegistry().all()),

		/** Toggle on-duty status for the calling character */
		setOnDuty: procedure
			.input(z.object({ onDuty: z.boolean() }))
			.mutation(({ input, ctx }) => {
				if (!ctx.charId) throw new RpcError('NOT_FOUND', 'No active character')
				service.setOnDuty(ctx.charId, input.onDuty)
				return { ok: true }
			}),

		/** Admin: assign a job + grade to a character */
		setJob: procedure
			.input(
				z.object({
					charId: z.number().int().positive(),
					jobName: z.string(),
					grade: z.number().int().min(0),
				}),
			)
			.mutation(({ input }) => {
				try {
					service.setJob(input.charId, input.jobName, input.grade)
					return { ok: true }
				} catch (err) {
					throw new RpcError(
						'VALIDATION_ERROR',
						err instanceof Error ? err.message : String(err),
					)
				}
			}),
	})
}
