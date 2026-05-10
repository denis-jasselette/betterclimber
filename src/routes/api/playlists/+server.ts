/**
 * /api/playlists
 *
 * GET  — List all playlists for the current user (id, name, item count).
 * POST — Create a playlist { name }.
 *
 * Requires an authenticated session (locals.user).
 */

import { error, json } from '@sveltejs/kit'
import { count, eq } from 'drizzle-orm'
import { db } from '$lib/server/db'
import { playlistItems, playlists } from '$lib/server/db/schema'
import type { RequestHandler } from './$types'

export const GET: RequestHandler = async ({ locals }) => {
	if (!locals.user) error(401, 'Authentication required')

	const rows = await db
		.select({
			id: playlists.id,
			name: playlists.name,
			created_at: playlists.created_at,
			item_count: count(playlistItems.id)
		})
		.from(playlists)
		.leftJoin(playlistItems, eq(playlists.id, playlistItems.playlist_id))
		.where(eq(playlists.user_id, locals.user.id))
		.groupBy(playlists.id, playlists.name, playlists.created_at)

	return json(rows)
}

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) error(401, 'Authentication required')

	let body: { name: string }
	try {
		body = await request.json()
	} catch {
		error(400, 'Invalid JSON body')
	}

	const { name } = body
	if (!name || typeof name !== 'string' || name.trim().length === 0) {
		error(400, 'name is required')
	}

	const [row] = await db
		.insert(playlists)
		.values({ user_id: locals.user.id, name: name.trim() })
		.returning()

	return json(row, { status: 201 })
}
