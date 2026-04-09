/**
 * Job registry — definitions of available jobs and their grade ladder.
 *
 * Concept v2.3, Chapter 8 + 18.
 *
 * GUARD-006: instance state, no globals. Modules instantiate the
 * registry inside their server() function and seed it with default jobs.
 */

export interface JobGrade {
	level: number
	name: string
	label: string
	salary: number
}

export interface JobDefinition {
	name: string
	label: string
	type: 'civilian' | 'leo' | 'ems' | 'gov' | 'private'
	grades: JobGrade[]
}

export class JobRegistry {
	private jobs = new Map<string, JobDefinition>()

	define(job: JobDefinition): void {
		if (job.grades.length === 0) {
			throw new Error(`Job '${job.name}' must define at least one grade`)
		}
		this.jobs.set(job.name, job)
	}

	get(name: string): JobDefinition | undefined {
		return this.jobs.get(name)
	}

	has(name: string): boolean {
		return this.jobs.has(name)
	}

	all(): JobDefinition[] {
		return Array.from(this.jobs.values())
	}

	getGrade(jobName: string, level: number): JobGrade | undefined {
		return this.get(jobName)?.grades.find((g) => g.level === level)
	}
}

export function defineJob(job: JobDefinition): JobDefinition {
	return job
}
