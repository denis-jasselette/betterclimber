import type { Angle } from '$lib/data/types'
import { parseFiltersFromUrl } from '$lib/url-filters'
import type { PageServerLoad } from './$types'

const DEFAULT_ANGLE: Angle = 45

export const load: PageServerLoad = async ({ url }) => {
	const { angle: parsedAngle, filters } = parseFiltersFromUrl(url)
	const angle = parsedAngle !== null ? parsedAngle : DEFAULT_ANGLE

	return { angle, filters }
}
