/**
 * PATCH /api/sessions/logs/[id] — update a session log (complete it, add RPE/notes).
 *
 * Requires authentication (401 if not signed in).
 * Returns 403 if the log belongs to a different user.
 * Returns 404 if the log does not exist.
 */

import { error, json } from '@sveltejs/kit'
import { and, eq } from 'drizzle-orm'
import { db } from '$lib/server/db'
import { sessionLogs } from '$lib/server/db/schema'
import type { RequestHandler } from './$types'

export const PATCH: RequestHandler = async ({ params, request, locals }) => {
	if (!locals.user) {
		error(401, 'Authentication required')
	}

	const { id } = params

	const existing = await db
		.select()
		.from(sessionLogs)
		.where(and(eq(sessionLogs.id, id), eq(sessionLogs.user_id, locals.user.id)))
		.limit(1)

	if (existing.length === 0) {
		// Check if it exists at all (to distinguish 404 vs 403)
		const any = await db
			.select({ id: sessionLogs.id })
			.from(sessionLogs)
			.where(eq(sessionLogs.id, id))
			.limit(1)
		if (any.length === 0) {
			error(404, 'Session log not found')
		}
		error(403, 'Forbidden')
	}

	let body: {
		completed_at?: string | null
		rpe?: number | null
		notes?: string | null
	}
	try {
		body = await request.json()
	} catch {
		error(400, 'Invalid JSON body')
	}

	if (body.rpe !== undefined && body.rpe !== null) {
		if (!Number.isInteger(body.rpe) || body.rpe < 1 || body.rpe > 10) {
			error(400, 'rpe must be an integer between 1 and 10')
		}
	}

	const updateValues: {
		completed_at?: Date | null
		rpe?: number | null
		notes?: string | null
	} = {}

	if (body.completed_at !== undefined) {
		updateValues.completed_at = body.completed_at ? new Date(body.completed_at) : null
	}
	if (body.rpe !== undefined) {
		updateValues.rpe = body.rpe
	}
	if (body.notes !== undefined) {
		updateValues.notes = body.notes
	}

	const updated = await db
		.update(sessionLogs)
		.set(updateValues)
		.where(and(eq(sessionLogs.id, id), eq(sessionLogs.user_id, locals.user.id)))
		.returning()

	return json(updated[0])
}
