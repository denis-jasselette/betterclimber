/**
 * /api/playlists/[id] — single playlist operations.
 *
 * GET    /api/playlists/[id]   Returns the playlist with its ordered items.
 * PATCH  /api/playlists/[id]   Body: { name } — renames the playlist.
 * DELETE /api/playlists/[id]   Deletes the playlist and all its items.
 */

import { json } from '@sveltejs/kit'
import { eq } from 'drizzle-orm'
import { db } from '$lib/server/db'
import { playlists } from '$lib/server/db/schema'
import {
	itemToJson,
	loadPlaylistItems,
	parseNameBody,
	resolveOwnedPlaylist
} from '$lib/server/playlists'
import type { RequestHandler } from './$types'

export const GET: RequestHandler = async ({ params, cookies }) => {
	const { playlist } = await resolveOwnedPlaylist(cookies, params.id)
	const items = await loadPlaylistItems(params.id)

	return json({
		id: playlist.id,
		name: playlist.name,
		created_at: playlist.created_at?.toISOString() ?? new Date().toISOString(),
		items: items.map(itemToJson)
	})
}

export const PATCH: RequestHandler = async ({ params, request, cookies }) => {
	const name = await parseNameBody(request)
	await resolveOwnedPlaylist(cookies, params.id)

	const now = new Date()
	await db.update(playlists).set({ name, updated_at: now }).where(eq(playlists.id, params.id))

	return json({ id: params.id, name, updated_at: now.toISOString() })
}

export const DELETE: RequestHandler = async ({ params, cookies }) => {
	await resolveOwnedPlaylist(cookies, params.id)
	await db.delete(playlists).where(eq(playlists.id, params.id))
	return new Response(null, { status: 204 })
}
