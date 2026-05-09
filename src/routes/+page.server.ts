import type { Angle } from '$lib/data/types'
import { parseFiltersFromUrl } from '$lib/url-filters'
import type { PageServerLoad } from './$types'

const FALLBACK_ANGLE: Angle = 45

export const load: PageServerLoad = async ({ url, parent }) => {
	const { settings } = await parent()
	const { angle: parsedAngle, filters } = parseFiltersFromUrl(url)
	const angle = parsedAngle !== null ? parsedAngle : (settings.defaultAngle ?? FALLBACK_ANGLE)

	return { angle, filters }
}
