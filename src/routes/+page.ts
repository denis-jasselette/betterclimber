import { searchClimbs } from '$lib/data/repository'
import type { Angle } from '$lib/data/types'
import { ALL_ANGLES } from '$lib/data/types'
import type { PageLoad } from './$types'

export const load: PageLoad = async ({ url }) => {
	const raw = url.searchParams.get('angle')
	const parsed = Number(raw)
	const angle =
		raw !== null && (ALL_ANGLES as ReadonlyArray<number>).includes(parsed)
			? (parsed as Angle)
			: null

	// On the server (or first client navigation) we can already run the search.
	// Filters are localStorage-only so we pass empty filters here; the client
	// will re-run with the full filter set once it hydrates.
	const results = angle !== null ? await searchClimbs({}, angle) : []

	return { angle, results }
}
