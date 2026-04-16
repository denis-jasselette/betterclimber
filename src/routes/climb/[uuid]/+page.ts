import { getClimb } from '$lib/data/repository'
import type { Angle } from '$lib/data/types'
import { ALL_ANGLES } from '$lib/data/types'
import { resultsStore } from '$lib/results-store.svelte'
import type { PageLoad } from './$types'

export const ssr = false

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

	return { item, angle }
}
