import type { NuiBrowser } from '@nextvm/nui/browser'
import type { ReactNode } from 'react'
import { NuiContext } from './context'

/**
 * Wrap your NUI app in this provider so child components can use
 * `useNuiBus()`, `useNuiMessage()`, etc.
 *
 *   import { NuiBrowser } from '@nextvm/nui/browser'
 *   import { NuiProvider } from '@nextvm/nui-react'
 *
 *   const bus = new NuiBrowser({ resourceName: 'my-server' })
 *
 *   createRoot(document.getElementById('root')!).render(
 *     <NuiProvider bus={bus}>
 *       <App />
 *     </NuiProvider>,
 *   )
 */
export interface NuiProviderProps {
	bus: NuiBrowser
	children: ReactNode
}

export function NuiProvider({ bus, children }: NuiProviderProps): ReactNode {
	return <NuiContext.Provider value={bus}>{children}</NuiContext.Provider>
}
