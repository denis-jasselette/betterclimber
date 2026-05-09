/**
 * Shared helpers for the playlists API endpoints.
 */

import { error } from '@sveltejs/kit'
import { asc, eq } from 'drizzle-orm'
import { db } from '$lib/server/db'
import { playlistItems, playlists } from '$lib/server/db/schema'
import { resolveUserId } from '$lib/server/users'

export { resolveUserId } from '$lib/server/users'

export const ANON_COOKIE = 'kb_anon_id'

/** Parse and validate a `{ name: string }` JSON body from a Request. Throws on failure. */
export async function parseNameBody(request: Request): Promise<string> {
	let body: { name?: string }
	try {
		body = await request.json()
	} catch {
		error(400, 'Invalid JSON body')
	}
	const name = body.name?.trim()
	if (!name) error(400, 'name is required')
	return name
}

/** Serialise a playlist_items row to a plain JSON-safe object. */
export function itemToJson(i: {
	playlist_id: string
	climb_uuid: string
	position: number
	added_at: Date | null
}) {
	return {
		playlist_id: i.playlist_id,
		climb_uuid: i.climb_uuid,
		position: i.position,
		added_at: i.added_at?.toISOString() ?? new Date().toISOString()
	}
}

/** Fetch all items in a playlist ordered by position. */
export async function loadPlaylistItems(playlistId: string) {
	return db
		.select()
		.from(playlistItems)
		.where(eq(playlistItems.playlist_id, playlistId))
		.orderBy(asc(playlistItems.position))
}

/** Verify the playlist exists and belongs to the calling user. Throws on failure. */
async function getOwnedPlaylist(id: string, userId: string) {
	const rows = await db.select().from(playlists).where(eq(playlists.id, id)).limit(1)
	if (rows.length === 0) error(404, 'Playlist not found')
	if (rows[0].user_id !== userId) error(403, 'Forbidden')
	return rows[0]
}

/**
 * Resolve the authenticated user and verify they own the given playlist.
 * Throws on missing cookie, missing playlist, or wrong owner.
 */
export async function resolveOwnedPlaylist(
	cookies: { get(name: string): string | undefined },
	playlistId: string
) {
	const anonId = cookies.get(ANON_COOKIE)
	if (!anonId) error(401, 'No anonymous ID cookie')
	const userId = await resolveUserId(anonId)
	const playlist = await getOwnedPlaylist(playlistId, userId)
	return { userId, playlist }
}
