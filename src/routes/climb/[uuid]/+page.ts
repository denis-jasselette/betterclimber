import { getCustomClimb, toClimbWithStats } from '$lib/data/custom-climbs'
import { getClimb } from '$lib/data/repository'
import type { Angle } from '$lib/data/types'
import { ALL_ANGLES } from '$lib/data/types'
import { resultsStore } from '$lib/results-store.svelte'
import type { PageLoad } from './$types'

export const ssr = false

/** A minimal playlist context as returned by /api/playlists/[id] */
export type PlaylistContext = {
	playlistId: string
	/** Ordered list of climb UUIDs in playlist position order */
	climbUuids: string[]
	/** 0-based position of the current climb */
	pos: number
}

export const load: PageLoad = async ({ params, url, fetch }) => {
	const raw = url.searchParams.get('angle')
	const parsed = Number(raw)
	const angle =
		raw !== null && (ALL_ANGLES as ReadonlyArray<number>).includes(parsed)
			? (parsed as Angle)
			: null

	// ── Playlist session context ───────────────────────────────────────────────
	const playlistId = url.searchParams.get('playlist')
	const rawPos = url.searchParams.get('pos')
	let playlistCtx: PlaylistContext | null = null

	if (playlistId && rawPos !== null) {
		const pos = Number(rawPos)
		try {
			const res = await fetch(`/api/playlists/${playlistId}`)
			if (res.ok) {
				const data = (await res.json()) as {
					items: { climb_uuid: string; position: number }[]
				}
				const sorted = [...data.items].sort((a, b) => a.position - b.position)
				const climbUuids = sorted.map((i) => i.climb_uuid)
				// Clamp pos to valid range
				const clampedPos = Math.max(0, Math.min(pos, climbUuids.length - 1))
				playlistCtx = { playlistId, climbUuids, pos: clampedPos }
			}
		} catch {
			// Network error — degrade gracefully, no session bar shown
		}
	}

	// Check custom climbs first (localStorage, no API needed)
	const custom = getCustomClimb(params.uuid)
	if (custom) return { item: toClimbWithStats(custom), angle, playlistCtx }

	// If the item is already in the results store (client-side swipe navigation),
	// return it immediately — no API round-trip needed.
	const fromStore = resultsStore.list.find((r) => r.climb.uuid === params.uuid) ?? null
	const item = fromStore ?? (await getClimb(params.uuid, angle))

	return { item, angle, playlistCtx }
}
