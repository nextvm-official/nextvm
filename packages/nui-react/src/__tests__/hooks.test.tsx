import { NuiBrowser } from '@nextvm/nui/browser'
import { act, render, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { NuiProvider } from '../provider'
import {
	useNuiCallback,
	useNuiMessage,
	useNuiRequest,
	useNuiState,
} from '../hooks'
import { useNuiBus } from '../context'

/**
 * Build a NuiBrowser backed by an in-memory window stub. Each call to
 * `dispatch(envelope)` simulates a postMessage from the FiveM client.
 */
const buildBus = (
	overrides: { fetchImpl?: typeof fetch } = {},
) => {
	type Listener = (ev: MessageEvent) => void
	const listeners: Listener[] = []
	const win = {
		addEventListener: (_e: string, h: Listener) => listeners.push(h),
		removeEventListener: () => undefined,
	}
	const fetchCalls: Array<[string, RequestInit | undefined]> = []
	const defaultFetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
		fetchCalls.push([String(input), init])
		return {
			ok: true,
			status: 200,
			json: async () => ({ pong: true }),
		} as unknown as Response
	}) as typeof fetch
	const bus = new NuiBrowser({
		resourceName: 'nextvm-test',
		window: win as unknown as Window,
		fetch: overrides.fetchImpl ?? defaultFetch,
	})
	return {
		bus,
		fetchCalls,
		dispatch: (data: unknown) => {
			for (const l of listeners) l({ data } as MessageEvent)
		},
	}
}

describe('useNuiBus', () => {
	it('throws outside a provider', () => {
		expect(() => renderHook(() => useNuiBus())).toThrow(/NuiProvider/)
	})

	it('returns the bus from the provider', () => {
		const { bus } = buildBus()
		const wrapper = ({ children }: { children: React.ReactNode }) => (
			<NuiProvider bus={bus}>{children}</NuiProvider>
		)
		const { result } = renderHook(() => useNuiBus(), { wrapper })
		expect(result.current).toBe(bus)
	})
})

describe('useNuiMessage', () => {
	it('subscribes to a channel and forwards data', async () => {
		const { bus, dispatch } = buildBus()
		const handler = vi.fn()
		renderHook(() => useNuiMessage('hud.update', handler, bus))
		act(() => {
			dispatch({ kind: 'event', channel: 'hud.update', data: { hp: 50 } })
		})
		await waitFor(() => expect(handler).toHaveBeenCalledWith({ hp: 50 }))
	})

	it('always uses the latest handler closure', async () => {
		const { bus, dispatch } = buildBus()
		let captured = 0
		const { rerender } = renderHook(
			({ multiplier }: { multiplier: number }) =>
				useNuiMessage<{ n: number }>(
					'a',
					(d) => {
						captured = d.n * multiplier
					},
					bus,
				),
			{ initialProps: { multiplier: 1 } },
		)
		rerender({ multiplier: 10 })
		act(() => dispatch({ kind: 'event', channel: 'a', data: { n: 3 } }))
		await waitFor(() => expect(captured).toBe(30))
	})

	it('cleans up on unmount', async () => {
		const { bus, dispatch } = buildBus()
		const handler = vi.fn()
		const { unmount } = renderHook(() => useNuiMessage('a', handler, bus))
		unmount()
		act(() => dispatch({ kind: 'event', channel: 'a', data: 1 }))
		// Allow microtask flush
		await Promise.resolve()
		expect(handler).not.toHaveBeenCalled()
	})
})

describe('useNuiState', () => {
	it('starts with the initial value and updates on push', async () => {
		const { bus, dispatch } = buildBus()
		const { result } = renderHook(() =>
			useNuiState<{ hp: number }>('hud', { hp: 100 }, bus),
		)
		expect(result.current.hp).toBe(100)
		act(() => dispatch({ kind: 'event', channel: 'hud', data: { hp: 42 } }))
		await waitFor(() => expect(result.current.hp).toBe(42))
	})
})

describe('useNuiCallback', () => {
	it('returns a function that posts to the bus', async () => {
		const { bus, fetchCalls } = buildBus()
		const { result } = renderHook(() => useNuiCallback('shop.buy', bus))
		const response = await result.current({ id: 'water' })
		expect(response).toEqual({ pong: true })
		expect(fetchCalls).toHaveLength(1)
		expect(fetchCalls[0][0]).toBe('https://nextvm-test/shop.buy')
		expect(JSON.parse(String(fetchCalls[0][1]?.body))).toEqual({ id: 'water' })
	})
})

describe('useNuiRequest', () => {
	it('tracks loading + data on success', async () => {
		const { bus } = buildBus()
		const { result } = renderHook(() => useNuiRequest<{ pong: boolean }>('a', bus))
		expect(result.current.loading).toBe(false)
		expect(result.current.data).toBeNull()

		await act(async () => {
			await result.current.call()
		})
		expect(result.current.loading).toBe(false)
		expect(result.current.data).toEqual({ pong: true })
		expect(result.current.error).toBeNull()
	})

	it('tracks error when fetch fails', async () => {
		const fetchImpl = (async () => {
			throw new Error('boom')
		}) as typeof fetch
		const { bus } = buildBus({ fetchImpl })
		const { result } = renderHook(() => useNuiRequest('a', bus))
		await act(async () => {
			await result.current.call()
		})
		expect(result.current.error?.message).toMatch(/boom/)
		expect(result.current.data).toBeNull()
		expect(result.current.loading).toBe(false)
	})

	it('reset clears state', async () => {
		const { bus } = buildBus()
		const { result } = renderHook(() => useNuiRequest('a', bus))
		await act(async () => {
			await result.current.call()
		})
		expect(result.current.data).not.toBeNull()
		act(() => result.current.reset())
		expect(result.current.data).toBeNull()
		expect(result.current.error).toBeNull()
		expect(result.current.loading).toBe(false)
	})
})

describe('NuiProvider integration', () => {
	it('hooks find the bus through the provider', async () => {
		const { bus, dispatch } = buildBus()
		const wrapper = ({ children }: { children: React.ReactNode }) => (
			<NuiProvider bus={bus}>{children}</NuiProvider>
		)
		const { result } = renderHook(
			() => useNuiState<{ hp: number }>('hud', { hp: 100 }),
			{ wrapper },
		)
		act(() => dispatch({ kind: 'event', channel: 'hud', data: { hp: 7 } }))
		await waitFor(() => expect(result.current.hp).toBe(7))
	})

	it('renders a component subtree using the provider', () => {
		const { bus } = buildBus()
		function Inner() {
			const ctxBus = useNuiBus()
			return <div>{ctxBus ? 'ok' : 'no'}</div>
		}
		const { container } = render(
			<NuiProvider bus={bus}>
				<Inner />
			</NuiProvider>,
		)
		expect(container.textContent).toBe('ok')
	})
})
