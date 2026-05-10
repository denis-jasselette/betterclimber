/**
 * Shared helpers for playlist API routes.
 */

import { error } from '@sveltejs/kit'
import { eq } from 'drizzle-orm'
import { db } from '$lib/server/db'
import { playlists } from '$lib/server/db/schema'

/**
 * Fetch a playlist by id and verify it belongs to userId.
 * Throws 404 if not found, 403 if owned by a different user.
 */
export async function getOwnedPlaylist(playlistId: string, userId: string) {
	const [playlist] = await db.select().from(playlists).where(eq(playlists.id, playlistId)).limit(1)

	if (!playlist) error(404, 'Playlist not found')
	if (playlist.user_id !== userId) error(403, 'Forbidden')

	return playlist
}
