import type { NuiBrowser } from '@nextvm/nui/browser'
import { useCallback, useContext, useEffect, useRef, useState } from 'react'
import { NuiContext } from './context'

/**
 * Resolve the NuiBrowser to use: explicit arg wins, otherwise pull from
 * the surrounding `<NuiProvider>`. We always call `useContext` (rules
 * of hooks) and only branch on the result.
 */
function resolveBus(explicit?: NuiBrowser): NuiBrowser {
	const fromContext = useContext(NuiContext)
	const bus = explicit ?? fromContext
	if (!bus) {
		throw new Error(
			'NuiBrowser is not available. Pass it as an argument or wrap your tree in <NuiProvider bus={bus}>.',
		)
	}
	return bus
}

/**
 * React hooks for the NextVM NUI bridge.
 *
 * Concept v2.3, Chapter 19.
 *
 * All hooks accept an optional `bus` argument so tests (and apps that
 * intentionally avoid the provider) can pass an instance directly. If
 * omitted, the hook reads the `NuiBrowser` from `<NuiProvider>`.
 */

/**
 * Subscribe to a one-way push from the FiveM client over a NUI channel.
 *
 *   useNuiMessage<HudState>('hud.update', (state) => setHud(state))
 *
 * The handler is wrapped in a stable ref so re-renders don't churn the
 * underlying subscription. The cleanup runs on unmount.
 */
export function useNuiMessage<T = unknown>(
	channel: string,
	handler: (data: T) => void,
	bus?: NuiBrowser,
): void {
	const ctxBus = resolveBus(bus)
	const handlerRef = useRef(handler)
	handlerRef.current = handler
	useEffect(() => {
		return ctxBus.on(channel, (data) => handlerRef.current(data as T))
	}, [ctxBus, channel])
}

/**
 * Subscribe to the latest value pushed over a channel and expose it as
 * React state. Equivalent to `useNuiMessage` + `useState` but in one
 * call. The initial value is used until the first message arrives.
 *
 *   const hud = useNuiState<HudState>('hud.update', { hp: 100, armor: 0 })
 */
export function useNuiState<T>(
	channel: string,
	initial: T,
	bus?: NuiBrowser,
): T {
	const [value, setValue] = useState<T>(initial)
	useNuiMessage<T>(channel, setValue, bus)
	return value
}

/**
 * Imperatively call a callback registered on the FiveM client side and
 * await its response.
 *
 *   const buy = useNuiCallback('shop.buy')
 *   await buy({ itemId: 'water' })
 *
 * The returned function is stable across re-renders for the same
 * channel + bus pair.
 */
export function useNuiCallback<TArgs = unknown, TResult = unknown>(
	channel: string,
	bus?: NuiBrowser,
): (data?: TArgs) => Promise<TResult> {
	const ctxBus = resolveBus(bus)
	return useCallback(
		(data?: TArgs) => ctxBus.call(channel, data) as Promise<TResult>,
		[ctxBus, channel],
	)
}

/**
 * Like `useNuiCallback`, but tracks the in-flight + result + error
 * state in React. Useful for buttons that should disable themselves
 * while a request is pending.
 *
 *   const { call, loading, data, error } = useNuiRequest<Offer[]>('shop.list')
 *   useEffect(() => { call() }, [call])
 */
export interface NuiRequestState<TResult> {
	call: (data?: unknown) => Promise<TResult | null>
	loading: boolean
	data: TResult | null
	error: Error | null
	reset: () => void
}

export function useNuiRequest<TResult = unknown>(
	channel: string,
	bus?: NuiBrowser,
): NuiRequestState<TResult> {
	const ctxBus = resolveBus(bus)
	const [loading, setLoading] = useState(false)
	const [data, setData] = useState<TResult | null>(null)
	const [error, setError] = useState<Error | null>(null)
	const mounted = useRef(true)
	useEffect(() => {
		mounted.current = true
		return () => {
			mounted.current = false
		}
	}, [])
	const call = useCallback(
		async (input?: unknown): Promise<TResult | null> => {
			setLoading(true)
			setError(null)
			try {
				const result = (await ctxBus.call(channel, input)) as TResult
				if (mounted.current) {
					setData(result)
					setLoading(false)
				}
				return result
			} catch (err) {
				const e = err instanceof Error ? err : new Error(String(err))
				if (mounted.current) {
					setError(e)
					setLoading(false)
				}
				return null
			}
		},
		[ctxBus, channel],
	)
	const reset = useCallback(() => {
		setData(null)
		setError(null)
		setLoading(false)
	}, [])
	return { call, loading, data, error, reset }
}
