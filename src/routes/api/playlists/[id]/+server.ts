/**
 * /api/playlists/[id]
 *
 * GET    — Get a playlist with its ordered items.
 * DELETE — Delete a playlist and its items.
 *
 * Requires an authenticated session (locals.user).
 * Returns 403 if the playlist belongs to a different user.
 */

import { error, json } from '@sveltejs/kit'
import { asc, eq } from 'drizzle-orm'
import { db } from '$lib/server/db'
import { playlistItems, playlists } from '$lib/server/db/schema'
import { getOwnedPlaylist } from '$lib/server/playlists'
import type { RequestHandler } from './$types'

export const GET: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) error(401, 'Authentication required')

	const playlist = await getOwnedPlaylist(params.id, locals.user.id)

	const items = await db
		.select()
		.from(playlistItems)
		.where(eq(playlistItems.playlist_id, params.id))
		.orderBy(asc(playlistItems.position))

	return json({ ...playlist, items })
}

export const DELETE: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) error(401, 'Authentication required')

	await getOwnedPlaylist(params.id, locals.user.id)

	await db.delete(playlists).where(eq(playlists.id, params.id))

	return new Response(null, { status: 204 })
}
