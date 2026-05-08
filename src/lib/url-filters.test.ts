import { describe, expect, it } from 'vitest'
import type { ClimbFilters } from '$lib/data/types'
import { filtersToParams, parseFiltersFromUrl } from './url-filters'

function roundtrip(
	angle: number | null,
	filters: Partial<ClimbFilters>
): ReturnType<typeof parseFiltersFromUrl> {
	const params = filtersToParams(angle, filters)
	return parseFiltersFromUrl(new URL(`http://x/?${params}`))
}

describe('filtersToParams → parseFiltersFromUrl roundtrip', () => {
	it('angle is preserved', () => {
		const { angle } = roundtrip(40, {})
		expect(angle).toBe(40)
	})

	it('null angle is preserved', () => {
		const { angle } = roundtrip(null, {})
		expect(angle).toBeNull()
	})

	it('invalid angle in URL → null', () => {
		const { angle } = parseFiltersFromUrl(new URL('http://x/?angle=999'))
		expect(angle).toBeNull()
	})

	it('gradeMin and gradeMax roundtrip', () => {
		const { filters } = roundtrip(40, { gradeMin: 'V3', gradeMax: 'V7' })
		expect(filters.gradeMin).toBe('V3')
		expect(filters.gradeMax).toBe('V7')
	})

	it('minQuality roundtrip', () => {
		const { filters } = roundtrip(40, { minQuality: 2 })
		expect(filters.minQuality).toBe(2)
	})

	it('minQuality=0 is not serialised (default)', () => {
		const { filters } = roundtrip(40, { minQuality: 0 })
		expect(filters.minQuality).toBeUndefined()
	})

	it('minQuality is clamped to 0–3 on parse', () => {
		const url = new URL('http://x/?qual=99')
		expect(parseFiltersFromUrl(url).filters.minQuality).toBe(3)
		const url2 = new URL('http://x/?qual=-5')
		expect(parseFiltersFromUrl(url2).filters.minQuality).toBe(0)
	})

	it('query roundtrips', () => {
		const { filters } = roundtrip(40, { query: 'crimp slab' })
		expect(filters.query).toBe('crimp slab')
	})

	it('boolean filters roundtrip: onlyBenchmarks', () => {
		expect(roundtrip(40, { onlyBenchmarks: true }).filters.onlyBenchmarks).toBe(true)
	})

	it('boolean filters roundtrip: onlyCampus', () => {
		expect(roundtrip(40, { onlyCampus: true }).filters.onlyCampus).toBe(true)
	})

	it('boolean filters roundtrip: onlyRoutes', () => {
		expect(roundtrip(40, { onlyRoutes: true }).filters.onlyRoutes).toBe(true)
	})

	it('boolean filters roundtrip: excludeTicked', () => {
		expect(roundtrip(40, { excludeTicked: true }).filters.excludeTicked).toBe(true)
	})

	it('boolean filters roundtrip: onlyAttempted', () => {
		expect(roundtrip(40, { onlyAttempted: true }).filters.onlyAttempted).toBe(true)
	})

	it('boolean filters roundtrip: onlyLiked', () => {
		expect(roundtrip(40, { onlyLiked: true }).filters.onlyLiked).toBe(true)
	})

	it('boolean filters roundtrip: onlyRecentlyLit', () => {
		expect(roundtrip(40, { onlyRecentlyLit: true }).filters.onlyRecentlyLit).toBe(true)
	})

	it('missing params → empty filters (defaults)', () => {
		const { filters } = parseFiltersFromUrl(new URL('http://x/'))
		expect(filters).toEqual({})
	})

	it('false boolean filters are not serialised', () => {
		const params = filtersToParams(40, { onlyBenchmarks: false })
		expect(params.has('bench')).toBe(false)
	})

	it('cursor roundtrips', () => {
		const params = filtersToParams(40, {}, 42)
		const { cursor } = parseFiltersFromUrl(new URL(`http://x/?${params}`))
		expect(cursor).toBe(42)
	})

	it('missing cursor → null', () => {
		const { cursor } = parseFiltersFromUrl(new URL('http://x/'))
		expect(cursor).toBeNull()
	})
})
