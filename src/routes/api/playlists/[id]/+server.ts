/**
 * /api/playlists/[id]
 *
 * GET    — Get a playlist with its ordered items.
 * PATCH  — Rename a playlist { name }.
 * DELETE — Delete a playlist and its items.
 *
 * Requires an authenticated session (locals.user).
 * Returns 403 if the playlist belongs to a different user.
 */

import { error, json } from '@sveltejs/kit'
import { asc, eq } from 'drizzle-orm'
import { db } from '$lib/server/db'
import { playlistItems, playlists } from '$lib/server/db/schema'
import { parseJsonBody, requireOwnedPlaylist } from '$lib/server/playlists'
import type { RequestHandler } from './$types'

export const GET: RequestHandler = async ({ params, locals }) => {
	const playlist = await requireOwnedPlaylist(params.id, locals.user)

	const items = await db
		.select()
		.from(playlistItems)
		.where(eq(playlistItems.playlist_id, params.id))
		.orderBy(asc(playlistItems.position))

	return json({ ...playlist, items })
}

export const PATCH: RequestHandler = async ({ params, request, locals }) => {
	await requireOwnedPlaylist(params.id, locals.user)

	const { name } = await parseJsonBody<{ name: string }>(request)
	if (!name || typeof name !== 'string' || name.trim().length === 0) {
		error(400, 'name is required')
	}

	const [updated] = await db
		.update(playlists)
		.set({ name: name.trim() })
		.where(eq(playlists.id, params.id))
		.returning()

	return json(updated)
}

export const DELETE: RequestHandler = async ({ params, locals }) => {
	await requireOwnedPlaylist(params.id, locals.user)

	await db.delete(playlists).where(eq(playlists.id, params.id))

	return new Response(null, { status: 204 })
}
