import { afterEach, describe, expect, it, vi } from 'vitest'
import { createLogger, Logger } from '../src'

describe('Logger', () => {
	const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
	const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
	const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

	afterEach(() => {
		logSpy.mockClear()
		warnSpy.mockClear()
		errorSpy.mockClear()
	})

	it('emits structured JSON for info', () => {
		const log = createLogger('test')
		log.info('hello', { userId: 1 })
		expect(logSpy).toHaveBeenCalledTimes(1)
		const payload = JSON.parse(logSpy.mock.calls[0]?.[0] as string)
		expect(payload.level).toBe('INFO')
		expect(payload.module).toBe('test')
		expect(payload.msg).toBe('hello')
		expect(payload.data).toEqual({ userId: 1 })
		expect(payload.timestamp).toBeTruthy()
	})

	it('routes errors to console.error', () => {
		const log = createLogger('test')
		log.error('boom')
		expect(errorSpy).toHaveBeenCalledTimes(1)
		expect(logSpy).not.toHaveBeenCalled()
	})

	it('routes warnings to console.warn', () => {
		const log = createLogger('test')
		log.warn('careful')
		expect(warnSpy).toHaveBeenCalledTimes(1)
	})

	it('respects min log level', () => {
		const log = new Logger('test', 'WARN')
		log.debug('hidden')
		log.info('hidden')
		log.warn('shown')
		expect(logSpy).not.toHaveBeenCalled()
		expect(warnSpy).toHaveBeenCalledTimes(1)
	})

	it('child logger merges context into entries', () => {
		const log = createLogger('test')
		const child = log.child({ requestId: 'abc' })
		child.info('hello', { extra: 1 })
		const payload = JSON.parse(logSpy.mock.calls[0]?.[0] as string)
		expect(payload.data).toEqual({ requestId: 'abc', extra: 1 })
	})

	it('setLevel changes the threshold dynamically', () => {
		const log = new Logger('test', 'INFO')
		log.setLevel('ERROR')
		log.info('hidden')
		log.error('shown')
		expect(logSpy).not.toHaveBeenCalled()
		expect(errorSpy).toHaveBeenCalledTimes(1)
	})
})
