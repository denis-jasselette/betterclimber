import { preloadData } from '$app/navigation'
import { getClimb } from '$lib/data/repository'
import type { Angle } from '$lib/data/types'
import { ALL_ANGLES } from '$lib/data/types'
import { resultsStore } from '$lib/results-store.svelte'
import type { PageLoad } from './$types'

export const ssr = false

const PREFETCH_RADIUS = 10

export const load: PageLoad = async ({ params, url }) => {
	const raw = url.searchParams.get('angle')
	const parsed = Number(raw)
	const angle =
		raw !== null && (ALL_ANGLES as ReadonlyArray<number>).includes(parsed)
			? (parsed as Angle)
			: null

	// If the item is already in the results store (client-side swipe navigation),
	// return it immediately — no API round-trip needed.
	const fromStore = resultsStore.list.find((r) => r.climb.uuid === params.uuid) ?? null
	const item = fromStore ?? (await getClimb(params.uuid, angle))

	// Prefetch neighboring pages so subsequent swipes are instant.
	// Fire-and-forget: we don't await these — they populate SvelteKit's data cache.
	const currentIndex = resultsStore.indexOf(params.uuid)
	if (currentIndex !== -1) {
		const list = resultsStore.list
		const angleQuery = angle !== null ? `?angle=${angle}` : ''
		const start = Math.max(0, currentIndex - PREFETCH_RADIUS)
		const end = Math.min(list.length - 1, currentIndex + PREFETCH_RADIUS)

		for (let i = start; i <= end; i++) {
			if (i === currentIndex) continue
			const neighbor = list[i]
			// preloadData caches the load function result; goto() uses the cache.
			preloadData(`/climb/${neighbor.climb.uuid}${angleQuery}`)
		}
	}

	return { item, angle }
}
