/**
 * /api/playlists/[id]/items/[itemId]
 *
 * DELETE — Remove an item from a playlist.
 * PATCH  — Update position { position } for reordering.
 *
 * Requires an authenticated session (locals.user).
 * Returns 403 if the playlist belongs to a different user.
 */

import { error, json } from '@sveltejs/kit'
import { eq } from 'drizzle-orm'
import { db } from '$lib/server/db'
import { playlistItems } from '$lib/server/db/schema'
import { parseJsonBody, requireOwnedPlaylist } from '$lib/server/playlists'
import type { RequestHandler } from './$types'

async function getPlaylistItem(itemId: string, playlistId: string) {
	const [item] = await db.select().from(playlistItems).where(eq(playlistItems.id, itemId)).limit(1)

	if (!item) error(404, 'Item not found')
	if (item.playlist_id !== playlistId) error(404, 'Item not found')

	return item
}

export const DELETE: RequestHandler = async ({ params, locals }) => {
	await requireOwnedPlaylist(params.id, locals.user)
	await getPlaylistItem(params.itemId, params.id)

	await db.delete(playlistItems).where(eq(playlistItems.id, params.itemId))

	return new Response(null, { status: 204 })
}

export const PATCH: RequestHandler = async ({ params, request, locals }) => {
	await requireOwnedPlaylist(params.id, locals.user)
	await getPlaylistItem(params.itemId, params.id)

	const { position } = await parseJsonBody<{ position: number }>(request)
	if (typeof position !== 'number' || !Number.isInteger(position) || position < 0) {
		error(400, 'position must be a non-negative integer')
	}

	const [updated] = await db
		.update(playlistItems)
		.set({ position })
		.where(eq(playlistItems.id, params.itemId))
		.returning()

	return json(updated)
}
