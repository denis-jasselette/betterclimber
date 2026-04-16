import { redirect } from '@sveltejs/kit'
import { browser } from '$app/environment'
import type { ClimbWithStats } from '$lib/data/types'
import { resultsStore } from '$lib/results-store.svelte'
import { parseFiltersFromUrl } from '$lib/url-filters'
import type { PageLoad } from './$types'

export const load: PageLoad = async ({ url, fetch }) => {
	const { angle, filters } = parseFiltersFromUrl(url)

	// Default to angle 45 when none is set — grade/quality/ascents are angle-specific.
	if (angle === null) {
		const params = new URLSearchParams(url.searchParams)
		params.set('angle', '45')
		redirect(302, `/?${params}`)
	}

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
