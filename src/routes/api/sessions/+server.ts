/**
 * GET /api/sessions — list all public session templates (id, name, description).
 */

import { json } from '@sveltejs/kit'
import { eq } from 'drizzle-orm'
import { db } from '$lib/server/db'
import { sessionTemplates } from '$lib/server/db/schema'
import type { RequestHandler } from './$types'

export const GET: RequestHandler = async () => {
	const templates = await db
		.select({
			id: sessionTemplates.id,
			name: sessionTemplates.name,
			description: sessionTemplates.description
		})
		.from(sessionTemplates)
		.where(eq(sessionTemplates.is_public, true))
		.orderBy(sessionTemplates.created_at)

	return json(templates)
}
