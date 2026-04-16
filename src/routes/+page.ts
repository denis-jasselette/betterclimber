import { browser } from '$app/environment'
import type { Angle, ClimbWithStats } from '$lib/data/types'
import { ALL_ANGLES } from '$lib/data/types'
import { resultsStore } from '$lib/results-store.svelte'
import { parseFiltersFromUrl } from '$lib/url-filters'
import type { PageLoad } from './$types'

const DEFAULT_ANGLE: Angle = 45

export const load: PageLoad = async ({ url, fetch }) => {
	const { angle: parsedAngle, filters } = parseFiltersFromUrl(url)

	// Default to 45 when no valid angle is in the URL.
	// The replaceState effect in +page.svelte will update the URL to reflect it.
	const angle: Angle =
		parsedAngle !== null && (ALL_ANGLES as ReadonlyArray<number>).includes(parsedAngle)
			? parsedAngle
			: DEFAULT_ANGLE

	// On the client, if the store already has results (back navigation or
	// returning from detail page), return them instantly — no API round-trip.
	if (browser && resultsStore.list.length > 0) {
		return { angle, filters, results: resultsStore.list }
	}

	const res = await fetch(`/api/climbs?angle=${angle}&limit=50`)
	const results: ClimbWithStats[] = res.ok
		? ((await res.json()) as { climbs: ClimbWithStats[] }).climbs
		: []

	return { angle, filters, results }
}
