/**
 * GET  /api/sessions/logs — current user's session log history.
 * POST /api/sessions/logs — create a session log entry.
 *
 * Both routes require authentication (401 if not signed in).
 */

import { error, json } from '@sveltejs/kit'
import { desc, eq } from 'drizzle-orm'
import { db } from '$lib/server/db'
import { sessionLogs } from '$lib/server/db/schema'
import type { RequestHandler } from './$types'

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user) {
		error(401, 'Authentication required')
	}

	const logs = await db
		.select()
		.from(sessionLogs)
		.where(eq(sessionLogs.user_id, locals.user.id))
		.orderBy(desc(sessionLogs.started_at))

	return json(logs)
}

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) {
		error(401, 'Authentication required')
	}

	let body: { template_id?: string | null; started_at?: string; notes?: string | null }
	try {
		body = await request.json()
	} catch {
		error(400, 'Invalid JSON body')
	}

	const newLog = await db
		.insert(sessionLogs)
		.values({
			user_id: locals.user.id,
			template_id: body.template_id ?? null,
			started_at: body.started_at ? new Date(body.started_at) : new Date(),
			notes: body.notes ?? null
		})
		.returning()

	return json(newLog[0], { status: 201 })
}
