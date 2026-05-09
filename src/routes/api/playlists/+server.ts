/**
 * /api/playlists — playlist CRUD.
 *
 * GET  /api/playlists   Returns all playlists for the caller with item counts.
 * POST /api/playlists   Body: { name } — creates a new playlist.
 *
 * User is resolved by anon_id cookie (always present).
 */

import { json } from '@sveltejs/kit'
import { count, eq } from 'drizzle-orm'
import { db } from '$lib/server/db'
import { playlistItems, playlists } from '$lib/server/db/schema'
import { ANON_COOKIE, parseNameBody, resolveUserId } from '$lib/server/playlists'
import type { RequestHandler } from './$types'

export const GET: RequestHandler = async ({ cookies }) => {
	const anonId = cookies.get(ANON_COOKIE)
	if (!anonId) return json([])

	const userId = await resolveUserId(anonId)

	const rows = await db
		.select({
			id: playlists.id,
			name: playlists.name,
			created_at: playlists.created_at,
			item_count: count(playlistItems.climb_uuid)
		})
		.from(playlists)
		.leftJoin(playlistItems, eq(playlistItems.playlist_id, playlists.id))
		.where(eq(playlists.user_id, userId))
		.groupBy(playlists.id, playlists.name, playlists.created_at)
		.orderBy(playlists.created_at)

	return json(
		rows.map((r) => ({
			id: r.id,
			name: r.name,
			created_at: r.created_at?.toISOString() ?? new Date().toISOString(),
			item_count: r.item_count
		}))
	)
}

export const POST: RequestHandler = async ({ request, cookies }) => {
	const anonId = cookies.get(ANON_COOKIE)
	if (!anonId) return json([], { status: 401 })

	const name = await parseNameBody(request)
	const userId = await resolveUserId(anonId)
	const id = crypto.randomUUID()
	const now = new Date()

	await db.insert(playlists).values({ id, user_id: userId, name, created_at: now, updated_at: now })

	return json({ id, name, created_at: now.toISOString(), item_count: 0 }, { status: 201 })
}
