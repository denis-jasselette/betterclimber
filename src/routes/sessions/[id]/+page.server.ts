/**
 * SSR load for /sessions/[id] — full template with blocks and exercises.
 */

import { error } from '@sveltejs/kit'
import { getTemplateDetail } from '$lib/data/session-service'
import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ params }) => {
	const template = await getTemplateDetail(params.id)
	if (!template) {
		error(404, 'Session template not found')
	}
	return { template }
}
