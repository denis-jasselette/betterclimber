/**
 * Shared helpers for playlist API routes.
 */

import { error } from '@sveltejs/kit'
import { eq } from 'drizzle-orm'
import { db } from '$lib/server/db'
import { playlists } from '$lib/server/db/schema'

/**
 * Assert user is authenticated and that they own the given playlist.
 * Throws 401 if not authenticated, 404/403 if playlist not found or not owned.
 */
export async function requireOwnedPlaylist(
	playlistId: string,
	user: { id: string } | undefined | null
) {
	if (!user) error(401, 'Authentication required')

	const [playlist] = await db.select().from(playlists).where(eq(playlists.id, playlistId)).limit(1)

	if (!playlist) error(404, 'Playlist not found')
	if (playlist.user_id !== user.id) error(403, 'Forbidden')

	return playlist
}

/**
 * Parse the JSON body of a request, throwing 400 on parse failure.
 */
export async function parseJsonBody<T>(request: Request): Promise<T> {
	try {
		return (await request.json()) as T
	} catch {
		error(400, 'Invalid JSON body')
	}
}
