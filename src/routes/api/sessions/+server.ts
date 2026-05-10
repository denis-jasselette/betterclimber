/**
 * GET /api/sessions — list all public session templates (id, name, description).
 */

import { json } from '@sveltejs/kit'
import { listPublicTemplates } from '$lib/data/session-service'
import type { RequestHandler } from './$types'

export const GET: RequestHandler = async () => {
	const templates = await listPublicTemplates()
	return json(templates)
}
