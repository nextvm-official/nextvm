import type { NuiBrowser } from '@nextvm/nui/browser'
import { createContext, useContext } from 'react'

/**
 * React context that carries a `NuiBrowser` instance through the
 * component tree. Wrap your app in `<NuiProvider bus={bus}>` once at
 * the top, then call `useNuiBus()` from anywhere below to access the
 * same instance.
 * provider component (which needs JSX) separate from the hook code so
 * tests can pass `bus` directly without rendering a provider.
 */
export const NuiContext = createContext<NuiBrowser | null>(null)

/**
 * Read the `NuiBrowser` from the surrounding `<NuiProvider>`.
 * Throws if there is no provider in the tree — that's almost always a
 * setup bug rather than something the caller can recover from, and a
 * loud error is better than a silent `null`.
 */
export function useNuiBus(): NuiBrowser {
	const bus = useContext(NuiContext)
	if (!bus) {
		throw new Error(
			'useNuiBus() called outside of <NuiProvider>. Wrap your app in <NuiProvider bus={bus}>.',
		)
	}
	return bus
}
