import { error } from '@sveltejs/kit'
import { getCustomClimb } from '$lib/data/custom-climbs'
import type { Angle } from '$lib/data/types'
import { ALL_ANGLES } from '$lib/data/types'
import type { PageLoad } from './$types'

export const ssr = false

export const load: PageLoad = ({ params, url }) => {
	const climb = getCustomClimb(params.uuid)
	if (!climb) error(404, 'Custom climb not found')

	const raw = url.searchParams.get('angle')
	const parsed = Number(raw)
	const angle =
		raw !== null && (ALL_ANGLES as ReadonlyArray<number>).includes(parsed)
			? (parsed as Angle)
			: null

	return { climb, angle }
}
