import { useNuiCallback, useNuiState } from '@nextvm/nui-react'

/**
 * Reference HUD for the Full Stack Example.
 *
 * Subscribes to two channels (`hud.update` and `notifications.show`)
 * and exposes one button that calls back into the client via
 * `useNuiCallback`. The whole component is roughly 40 lines and
 * touches every hook the package ships.
 */

interface HudState {
	hp: number
	armor: number
	cash: number
	bank: number
}

interface Notification {
	id: number
	message: string
	level: 'info' | 'warn' | 'error'
}

export default function App(): JSX.Element {
	const hud = useNuiState<HudState>('hud.update', {
		hp: 100,
		armor: 0,
		cash: 0,
		bank: 0,
	})
	const notification = useNuiState<Notification | null>('notifications.show', null)
	const dismissNotification = useNuiCallback<{ id: number }, { ok: boolean }>(
		'notifications.dismiss',
	)

	return (
		<div style={{ padding: 24 }}>
			<h1>NextVM Full Stack</h1>

			<section>
				<h2>HUD</h2>
				<div>HP: {hud.hp}</div>
				<div>Armor: {hud.armor}</div>
				<div>Cash: ${hud.cash}</div>
				<div>Bank: ${hud.bank}</div>
			</section>

			{notification && (
				<section style={{ marginTop: 16, opacity: 0.9 }}>
					<h2>{notification.level.toUpperCase()}</h2>
					<p>{notification.message}</p>
					<button
						type="button"
						onClick={() => dismissNotification({ id: notification.id })}
					>
						Dismiss
					</button>
				</section>
			)}
		</div>
	)
}
