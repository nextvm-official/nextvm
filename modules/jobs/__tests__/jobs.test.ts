import { describe, expect, it, vi } from 'vitest'
import { defineJob, JobRegistry, JobsService, type BankingAdapter } from '../src'

const buildRegistry = () => {
	const reg = new JobRegistry()
	reg.define(
		defineJob({
			name: 'police',
			label: 'Police',
			type: 'leo',
			grades: [
				{ level: 0, name: 'recruit', label: 'Recruit', salary: 100 },
				{ level: 1, name: 'officer', label: 'Officer', salary: 200 },
			],
		}),
	)
	reg.define(
		defineJob({
			name: 'unemployed',
			label: 'Unemployed',
			type: 'civilian',
			grades: [{ level: 0, name: 'none', label: 'None', salary: 0 }],
		}),
	)
	return reg
}

describe('JobRegistry', () => {
	it('rejects job definitions without grades', () => {
		const reg = new JobRegistry()
		expect(() =>
			reg.define({ name: 'broken', label: '', type: 'civilian', grades: [] }),
		).toThrow(/at least one grade/)
	})

	it('looks up jobs and grades', () => {
		const reg = buildRegistry()
		expect(reg.has('police')).toBe(true)
		expect(reg.getGrade('police', 1)?.salary).toBe(200)
		expect(reg.getGrade('police', 99)).toBeUndefined()
	})
})

describe('JobsService', () => {
	it('setJob writes job + grade', () => {
		const svc = new JobsService(buildRegistry())
		svc.setJob(1, 'police', 1)
		const state = svc.getJob(1)
		expect(state.job).toBe('police')
		expect(state.grade).toBe(1)
	})

	it('setJob rejects unknown job', () => {
		const svc = new JobsService(buildRegistry())
		expect(() => svc.setJob(1, 'astronaut', 0)).toThrow(/Unknown job/)
	})

	it('setJob rejects unknown grade', () => {
		const svc = new JobsService(buildRegistry())
		expect(() => svc.setJob(1, 'police', 99)).toThrow(/grade 99/)
	})

	it('setOnDuty toggles the on-duty flag', () => {
		const svc = new JobsService(buildRegistry())
		svc.setOnDuty(1, true)
		expect(svc.getJob(1).onDuty).toBe(true)
		svc.setOnDuty(1, false)
		expect(svc.getJob(1).onDuty).toBe(false)
	})

	it('paySalaries credits on-duty characters via the banking adapter', async () => {
		const banking = {
			addMoney: vi.fn(async (_charId: number, _type: 'cash' | 'bank', amount: number) => amount),
		} satisfies BankingAdapter
		const svc = new JobsService(buildRegistry(), banking)
		svc.setJob(1, 'police', 1) // grade 1 → 200/payout
		svc.setOnDuty(1, true)
		svc.setJob(2, 'police', 0) // not on duty
		svc.setJob(3, 'unemployed', 0)
		svc.setOnDuty(3, true)

		const result = await svc.paySalaries([1, 2, 3])
		expect(result.paid).toBe(1)
		expect(result.total).toBe(200)
		expect(banking.addMoney).toHaveBeenCalledOnce()
		expect(banking.addMoney).toHaveBeenCalledWith(1, 'bank', 200, 'salary:police')
	})

	it('paySalaries is a no-op when banking is unset', async () => {
		const svc = new JobsService(buildRegistry())
		svc.setJob(1, 'police', 0)
		svc.setOnDuty(1, true)
		const result = await svc.paySalaries([1])
		expect(result).toEqual({ paid: 0, total: 0 })
	})
})
