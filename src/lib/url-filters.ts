import type { Angle, ClimbFilters } from '$lib/data/types'
import { isAngle } from '$lib/data/types'

// ── URL ↔ filter serialisation ────────────────────────────────────────────────

export function filtersToParams(
	angle: number | null,
	filters: Partial<ClimbFilters> = {},
	cursor: number | null = null
): URLSearchParams {
	const p = new URLSearchParams()
	if (angle !== null) p.set('angle', String(angle))
	if (filters.query?.trim()) p.set('q', filters.query)
	if (filters.authorQuery?.trim()) p.set('author', filters.authorQuery)
	if (filters.nameQuery?.trim()) p.set('name', filters.nameQuery)
	if (filters.descriptionQuery?.trim()) p.set('desc', filters.descriptionQuery)
	if (filters.gradeMin) p.set('gmin', filters.gradeMin)
	if (filters.gradeMax) p.set('gmax', filters.gradeMax)
	if (filters.minQuality && filters.minQuality > 0) p.set('qual', String(filters.minQuality))
	if (filters.onlyBenchmarks) p.set('bench', '1')
	if (filters.onlyCampus) p.set('campus', '1')
	if (filters.onlyRoutes) p.set('routes', '1')
	if (filters.excludeTicked) p.set('noticked', '1')
	if (filters.onlyAttempted) p.set('attempted', '1')
	if (filters.onlyLiked) p.set('liked', '1')
	if (filters.onlyRecentlyLit) p.set('recent', '1')
	if (cursor !== null) p.set('cursor', String(cursor))
	return p
}

export function parseFiltersFromUrl(url: URL): {
	angle: Angle | null
	filters: Partial<ClimbFilters>
	cursor: number | null
} {
	const rawAngle = url.searchParams.get('angle')
	const parsedAngle = Number(rawAngle)
	const angle = rawAngle !== null && isAngle(parsedAngle) ? parsedAngle : null

	const filters: Partial<ClimbFilters> = {}
	const q = url.searchParams.get('q')
	const gmin = url.searchParams.get('gmin')
	const gmax = url.searchParams.get('gmax')
	const qual = url.searchParams.get('qual')

	if (q) filters.query = q
	const author = url.searchParams.get('author')
	const name = url.searchParams.get('name')
	const desc = url.searchParams.get('desc')
	if (author) filters.authorQuery = author
	if (name) filters.nameQuery = name
	if (desc) filters.descriptionQuery = desc
	if (gmin) filters.gradeMin = gmin
	if (gmax) filters.gradeMax = gmax
	if (qual) filters.minQuality = Math.max(0, Math.min(3, Number(qual)))
	if (url.searchParams.get('bench') === '1') filters.onlyBenchmarks = true
	if (url.searchParams.get('campus') === '1') filters.onlyCampus = true
	if (url.searchParams.get('routes') === '1') filters.onlyRoutes = true
	if (url.searchParams.get('noticked') === '1') filters.excludeTicked = true
	if (url.searchParams.get('attempted') === '1') filters.onlyAttempted = true
	if (url.searchParams.get('liked') === '1') filters.onlyLiked = true
	if (url.searchParams.get('recent') === '1') filters.onlyRecentlyLit = true

	const rawCursor = url.searchParams.get('cursor')
	const cursor = rawCursor !== null ? Number(rawCursor) : null

	return { angle, filters, cursor }
}
