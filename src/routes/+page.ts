import { browser } from '$app/environment'
import type { Angle, ClimbFilters, ClimbWithStats } from '$lib/data/types'
import { ALL_ANGLES } from '$lib/data/types'
import { resultsStore } from '$lib/results-store.svelte'
import type { PageLoad } from './$types'

// ── URL ↔ filter serialisation ────────────────────────────────────────────────
// Only shareable filters go in the URL. Personal filters (ticked, attempted,
// liked, recentlyLit) stay in localStorage only.

export function filtersToParams(
	angle: number | null,
	filters: Partial<ClimbFilters>
): URLSearchParams {
	const p = new URLSearchParams()
	if (angle !== null) p.set('angle', String(angle))
	if (filters.query?.trim()) p.set('q', filters.query.trim())
	if (filters.gradeMin) p.set('gmin', filters.gradeMin)
	if (filters.gradeMax) p.set('gmax', filters.gradeMax)
	if (filters.minQuality && filters.minQuality > 0) p.set('qual', String(filters.minQuality))
	if (filters.onlyBenchmarks) p.set('bench', '1')
	if (filters.onlyCampus) p.set('campus', '1')
	if (filters.onlyRoutes) p.set('routes', '1')
	return p
}

function parseFiltersFromUrl(url: URL): {
	angle: Angle | null
	filters: Partial<ClimbFilters>
} {
	const rawAngle = url.searchParams.get('angle')
	const parsedAngle = Number(rawAngle)
	const angle =
		rawAngle !== null && (ALL_ANGLES as ReadonlyArray<number>).includes(parsedAngle)
			? (parsedAngle as Angle)
			: null

	const filters: Partial<ClimbFilters> = {}
	const q = url.searchParams.get('q')
	const gmin = url.searchParams.get('gmin')
	const gmax = url.searchParams.get('gmax')
	const qual = url.searchParams.get('qual')

	if (q) filters.query = q
	if (gmin) filters.gradeMin = gmin
	if (gmax) filters.gradeMax = gmax
	if (qual) filters.minQuality = Math.max(0, Math.min(3, Number(qual)))
	if (url.searchParams.get('bench') === '1') filters.onlyBenchmarks = true
	if (url.searchParams.get('campus') === '1') filters.onlyCampus = true
	if (url.searchParams.get('routes') === '1') filters.onlyRoutes = true

	return { angle, filters }
}

export const load: PageLoad = async ({ url, fetch }) => {
	const { angle, filters } = parseFiltersFromUrl(url)

	// On the client, if the store already has results (back navigation or
	// returning from detail page), return them instantly — no API round-trip.
	if (browser && resultsStore.list.length > 0) {
		return { angle, filters, results: resultsStore.list }
	}

	// SSR or empty store: fetch the first page from the API.
	if (angle === null) {
		return { angle: null, filters, results: [] as ClimbWithStats[] }
	}

	const res = await fetch(`/api/climbs?angle=${angle}&limit=50`)
	const results: ClimbWithStats[] = res.ok
		? ((await res.json()) as { climbs: ClimbWithStats[] }).climbs
		: []

	return { angle, filters, results }
}
