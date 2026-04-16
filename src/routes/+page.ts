import { browser } from '$app/environment'
import type { Angle, ClimbWithStats } from '$lib/data/types'
import { ALL_ANGLES } from '$lib/data/types'
import { resultsStore } from '$lib/results-store.svelte'
import type { PageLoad } from './$types'

export const load: PageLoad = async ({ url, fetch }) => {
	const raw = url.searchParams.get('angle')
	const parsed = Number(raw)
	const angle =
		raw !== null && (ALL_ANGLES as ReadonlyArray<number>).includes(parsed)
			? (parsed as Angle)
			: null

	// On the client, if the store already has results (back navigation or
	// returning from detail page), return them instantly — no API round-trip.
	if (browser && resultsStore.list.length > 0) {
		return { angle, results: resultsStore.list }
	}

	// SSR or empty store: fetch the first page from the API.
	if (angle === null) {
		return { angle: null, results: [] as ClimbWithStats[] }
	}

	const res = await fetch(`/api/climbs?angle=${angle}&limit=50`)
	const results: ClimbWithStats[] = res.ok
		? ((await res.json()) as { climbs: ClimbWithStats[] }).climbs
		: []

	return { angle, results }
}
