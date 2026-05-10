/**
 * /api/playlists/[id]/items
 *
 * POST — Add a climb to a playlist { climb_uuid }. Appends to end.
 *
 * Requires an authenticated session (locals.user).
 * Returns 403 if the playlist belongs to a different user.
 */

import { error, json } from '@sveltejs/kit'
import { count, eq } from 'drizzle-orm'
import { db } from '$lib/server/db'
import { playlistItems } from '$lib/server/db/schema'
import { getOwnedPlaylist } from '$lib/server/playlists'
import type { RequestHandler } from './$types'

export const POST: RequestHandler = async ({ params, request, locals }) => {
	if (!locals.user) error(401, 'Authentication required')

	await getOwnedPlaylist(params.id, locals.user.id)

	let body: { climb_uuid: string }
	try {
		body = await request.json()
	} catch {
		error(400, 'Invalid JSON body')
	}

	const { climb_uuid } = body
	if (!climb_uuid || typeof climb_uuid !== 'string') {
		error(400, 'climb_uuid is required')
	}

	// Determine next position (current count)
	const [{ itemCount }] = await db
		.select({ itemCount: count(playlistItems.id) })
		.from(playlistItems)
		.where(eq(playlistItems.playlist_id, params.id))

	const position = itemCount

	const [item] = await db
		.insert(playlistItems)
		.values({ playlist_id: params.id, climb_uuid, position })
		.returning()

	return json(item, { status: 201 })
}
