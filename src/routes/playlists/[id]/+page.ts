import type { ClimbWithStats, PlaylistItem } from '$lib/data/types'
import type { PageLoad } from './$types'

export const ssr = false

interface PlaylistDetail {
	id: string
	name: string
	created_at: string
	items: PlaylistItem[]
}

export const load: PageLoad = async ({ params, fetch }) => {
	const res = await fetch(`/api/playlists/${params.id}`)
	if (!res.ok) {
		return { playlist: null, climbs: [], id: params.id }
	}

	const playlist = (await res.json()) as PlaylistDetail

	// Fetch all climb details for the playlist items
	const climbPromises = playlist.items.map(async (item) => {
		const climbRes = await fetch(`/api/climbs/${item.climb_uuid}`)
		if (!climbRes.ok) return null
		return (await climbRes.json()) as ClimbWithStats
	})

	const results = await Promise.all(climbPromises)
	const climbs = results.filter((c): c is ClimbWithStats => c !== null)

	return { playlist, climbs, id: params.id }
}
