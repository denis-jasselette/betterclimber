import type { ServerLoad } from '@sveltejs/kit'
import type { Angle, ClimbWithStats } from '$lib/data/types'
import { ALL_ANGLES } from '$lib/data/types'

export const load: ServerLoad = async ({ url, fetch }) => {
	const raw = url.searchParams.get('angle')
	const parsed = Number(raw)
	const angle =
		raw !== null && (ALL_ANGLES as ReadonlyArray<number>).includes(parsed)
			? (parsed as Angle)
			: null

	if (angle === null) {
		return { angle: null, results: [] as ClimbWithStats[] }
	}

	// Use SvelteKit's enhanced fetch — makes an efficient internal request to
	// the API route without a real network round-trip.
	const searchUrl = `/api/climbs?angle=${angle}&limit=50`
	const res = await fetch(searchUrl)
	if (!res.ok) {
		return { angle, results: [] as ClimbWithStats[] }
	}

	const { climbs: results } = (await res.json()) as { climbs: ClimbWithStats[] }
	return { angle, results }
}
