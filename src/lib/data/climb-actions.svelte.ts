/**
 * createClimbActions — shared reactive logic for climb interactions.
 *
 * Used by ClimbCard.svelte (list) and climb/[uuid]/+page.svelte (detail).
 * Call inside a Svelte component or another .svelte.ts context.
 *
 * @param getUuid    Reactive getter for the climb uuid
 * @param getAngle   Reactive getter for the current angle
 * @param getClimb   Reactive getter for the Climb object (null while loading)
 * @param connector  BLE board connector instance
 */

import type { BoardConnector } from '$lib/ble/board-connector.svelte'
import {
	getEntry,
	incrementAttempts,
	recordLitUp,
	resetAttempts,
	setLiked,
	setTicked
} from '$lib/data/log-service'
import { resolveHolds } from '$lib/data/repository'
import type { Climb } from '$lib/data/types'

export function createClimbActions(
	getUuid: () => string,
	getAngle: () => number | null,
	getClimb: () => Climb | null,
	getConnector: () => BoardConnector,
	getDifficulty: () => number | null = () => null
) {
	// ── Log state ────────────────────────────────────────────────────────────────
	// logSnapshot is a mutable $state object so that destructured references in
	// components remain valid and reactive. Svelte 5 $state objects are deep
	// reactive proxies — mutating properties in place propagates to all
	// dependents, whereas replacing the object reference would not.
	// Spread to capture a plain copy; TypeScript infers the shape from LogEntry.
	let logSnapshot = $state({ ...getEntry(getUuid(), getAngle()) })

	function refreshLog() {
		const entry = getEntry(getUuid(), getAngle())
		logSnapshot.ticked = entry.ticked
		logSnapshot.attemptCount = entry.attemptCount
		logSnapshot.liked = entry.liked
		logSnapshot.lastLitAt = entry.lastLitAt
	}

	// Re-sync when uuid or angle changes (navigating between climbs or
	// switching board angle).
	$effect(() => {
		getUuid()
		getAngle()
		refreshLog()
	})

	// ── Tick / Like ───────────────────────────────────────────────────────────────
	function toggleTick() {
		setTicked(getUuid(), getAngle(), !logSnapshot.ticked, getDifficulty())
		refreshLog()
	}

	function toggleLike() {
		setLiked(getUuid(), getAngle(), !logSnapshot.liked)
		refreshLog()
	}

	// ── Attempt: tap = +1, long-press = reset ─────────────────────────────────────
	let attemptPressTimer: ReturnType<typeof setTimeout> | null = null

	function onAttemptPointerDown() {
		attemptPressTimer = setTimeout(() => {
			attemptPressTimer = null
			resetAttempts(getUuid(), getAngle())
			refreshLog()
		}, 600)
	}

	function onAttemptPointerUp() {
		if (attemptPressTimer !== null) {
			clearTimeout(attemptPressTimer)
			attemptPressTimer = null
			incrementAttempts(getUuid(), getAngle())
			refreshLog()
		}
	}

	function onAttemptPointerLeave() {
		if (attemptPressTimer !== null) {
			clearTimeout(attemptPressTimer)
			attemptPressTimer = null
		}
	}

	// ── BLE ───────────────────────────────────────────────────────────────────────
	let lighting = $state(false)
	let lightError = $state<string | null>(null)

	async function lightUp() {
		const climb = getClimb()
		if (lighting || !climb) return
		lighting = true
		lightError = null
		try {
			const connector = getConnector()
			if (!connector.isConnected) {
				await connector.connect()
				if (!connector.isConnected) return
			}
			const holds = await resolveHolds(climb)
			await connector.lightUpClimb(holds)
			recordLitUp(climb.uuid, getAngle())
			refreshLog()
		} catch (err) {
			lightError = err instanceof Error ? err.message : 'Failed to send to board.'
		} finally {
			lighting = false
		}
	}

	return {
		get logSnapshot() {
			return logSnapshot
		},
		get lighting() {
			return lighting
		},
		get lightError() {
			return lightError
		},
		toggleTick,
		toggleLike,
		onAttemptPointerDown,
		onAttemptPointerUp,
		onAttemptPointerLeave,
		lightUp
	}
}
