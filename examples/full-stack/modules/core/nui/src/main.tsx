import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { NuiProvider } from '@nextvm/nui-react'
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error — virtual module resolved by @nextvm/vite-plugin-nui
import { NuiBrowser, resourceName } from 'virtual:nextvm-nui'
import App from './App'

const bus = new NuiBrowser({ resourceName })

const rootEl = document.getElementById('root')
if (!rootEl) throw new Error('Missing #root element in index.html')

createRoot(rootEl).render(
	<StrictMode>
		<NuiProvider bus={bus}>
			<App />
		</NuiProvider>
	</StrictMode>,
)
