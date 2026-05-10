/**
 * SSR load for /sessions — fetches all public session templates including block counts.
 */

import { listPublicTemplates } from '$lib/data/session-service'
import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async () => {
	const templates = await listPublicTemplates()
	return { templates }
}
