import type { JobRegistry } from './job-registry'
import { jobsState } from './state'

/**
 * Banking adapter — minimal interface this module needs from the banking
 * service. The actual implementation lives in @nextvm/banking; we type
 * only what we use to keep the dependency loose.
 */
export interface BankingAdapter {
	addMoney(
		charId: number,
		type: 'cash' | 'bank',
		amount: number,
		reason?: string,
	): Promise<number>
}

/**
 * JobsService — sits on top of jobsState and a banking adapter.
 * Server-authoritative writes and char-id keyed.
 */
export class JobsService {
	constructor(
		private readonly registry: JobRegistry,
		private banking: BankingAdapter | null = null,
	) {}

	setBanking(banking: BankingAdapter): void {
		this.banking = banking
	}

	getRegistry(): JobRegistry {
		return this.registry
	}

	getJob(charId: number): { job: string; grade: number; onDuty: boolean } {
		return jobsState.getAll(charId)
	}

	setJob(charId: number, jobName: string, grade: number): void {
		const def = this.registry.get(jobName)
		if (!def) throw new Error(`Unknown job: ${jobName}`)
		const gradeDef = def.grades.find((g) => g.level === grade)
		if (!gradeDef) throw new Error(`Job '${jobName}' has no grade ${grade}`)
		jobsState.set(charId, 'job', jobName)
		jobsState.set(charId, 'grade', grade)
	}

	setOnDuty(charId: number, onDuty: boolean): void {
		jobsState.set(charId, 'onDuty', onDuty)
	}

	/**
	 * Pay every on-duty character their current grade salary.
	 * Called by the salary tick — return the total amount paid for
	 * profiling / logging purposes.
	 */
	async paySalaries(charIds: number[]): Promise<{ paid: number; total: number }> {
		if (!this.banking) return { paid: 0, total: 0 }
		let paid = 0
		let total = 0
		for (const charId of charIds) {
			const state = jobsState.getAll(charId)
			if (!state.onDuty) continue
			const grade = this.registry.getGrade(state.job, state.grade)
			if (!grade || grade.salary <= 0) continue
			await this.banking.addMoney(charId, 'bank', grade.salary, `salary:${state.job}`)
			paid++
			total += grade.salary
		}
		return { paid, total }
	}
}
