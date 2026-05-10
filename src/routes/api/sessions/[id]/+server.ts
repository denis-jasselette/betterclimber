/**
 * GET /api/sessions/[id] — full template with blocks and exercises.
 */

import { error, json } from '@sveltejs/kit'
import { getTemplateDetail } from '$lib/data/session-service'
import type { RequestHandler } from './$types'

export const GET: RequestHandler = async ({ params }) => {
	const template = await getTemplateDetail(params.id)
	if (!template) {
		error(404, 'Session template not found')
	}
	return json(template)
}
