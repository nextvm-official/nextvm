import { defineState, z } from '@nextvm/core'

/**
 * Per-character job state.
 *
 * The player module already tracks the basic `job` string. The jobs
 * module adds grade + duty status as its own state container so the
 * player module stays decoupled (GUARD-002).
 */
export const jobsState = defineState('jobs', {
	job: z.string().default('unemployed').describe('Current job name'),
	grade: z.number().int().min(0).default(0).describe('Current grade level'),
	onDuty: z.boolean().default(false).describe('True if on-duty'),
})
