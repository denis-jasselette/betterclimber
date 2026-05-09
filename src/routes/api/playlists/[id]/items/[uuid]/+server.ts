/**
 * /api/playlists/[id]/items/[uuid] — remove a climb from a playlist.
 *
 * DELETE /api/playlists/[id]/items/[uuid]
 */

import { and, eq } from 'drizzle-orm'
import { db } from '$lib/server/db'
import { playlistItems } from '$lib/server/db/schema'
import { resolveOwnedPlaylist } from '$lib/server/playlists'
import type { RequestHandler } from './$types'

export const DELETE: RequestHandler = async ({ params, cookies }) => {
	await resolveOwnedPlaylist(cookies, params.id)

	await db
		.delete(playlistItems)
		.where(and(eq(playlistItems.playlist_id, params.id), eq(playlistItems.climb_uuid, params.uuid)))

	return new Response(null, { status: 204 })
}
