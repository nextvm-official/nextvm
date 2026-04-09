/**
 * @nextvm/nui-react — React hooks for the NextVM NUI bridge.
 *   import { NuiBrowser } from '@nextvm/nui/browser'
 *   import { NuiProvider, useNuiState, useNuiCallback } from '@nextvm/nui-react'
 *   const bus = new NuiBrowser({ resourceName: 'my-server' })
 *   function App() {
 *     const hud = useNuiState<HudState>('hud.update', { hp: 100, armor: 0 })
 *     const buy = useNuiCallback('shop.buy')
 *     return <button onClick={() => buy({ itemId: 'water' })}>Buy</button>
 *   }
 *   createRoot(root).render(<NuiProvider bus={bus}><App /></NuiProvider>)
 */

export { NuiContext, useNuiBus } from './context'
export { NuiProvider } from './provider'
export type { NuiProviderProps } from './provider'
export {
	useNuiMessage,
	useNuiState,
	useNuiCallback,
	useNuiRequest,
} from './hooks'
export type { NuiRequestState } from './hooks'
