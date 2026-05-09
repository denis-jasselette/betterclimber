/**
 * /api/playlists/[id]/items — manage items in a playlist.
 *
 * POST /api/playlists/[id]/items   Body: { climbUuid } — add a climb (idempotent).
 * PUT  /api/playlists/[id]/items   Body: { order: string[] } — reorder by UUID.
 */

import { error, json } from '@sveltejs/kit'
import { eq, max } from 'drizzle-orm'
import { db } from '$lib/server/db'
import { playlistItems } from '$lib/server/db/schema'
import { itemToJson, loadPlaylistItems, resolveOwnedPlaylist } from '$lib/server/playlists'
import type { RequestHandler } from './$types'

export const POST: RequestHandler = async ({ params, request, cookies }) => {
	let body: { climbUuid: string }
	try {
		body = await request.json()
	} catch {
		error(400, 'Invalid JSON body')
	}

	const { climbUuid } = body
	if (!climbUuid) error(400, 'climbUuid is required')

	await resolveOwnedPlaylist(cookies, params.id)

	// Idempotent: return existing item if already in the playlist
	const existing = await db
		.select()
		.from(playlistItems)
		.where(eq(playlistItems.playlist_id, params.id))
		.limit(999)

	const alreadyIn = existing.find((i) => i.climb_uuid === climbUuid)
	if (alreadyIn) return json(itemToJson(alreadyIn))

	// Append at the end
	const [{ maxPos }] = await db
		.select({ maxPos: max(playlistItems.position) })
		.from(playlistItems)
		.where(eq(playlistItems.playlist_id, params.id))

	const position = (maxPos ?? -1) + 1
	const now = new Date()

	await db.insert(playlistItems).values({
		playlist_id: params.id,
		climb_uuid: climbUuid,
		position,
		added_at: now
	})

	return json(
		itemToJson({ playlist_id: params.id, climb_uuid: climbUuid, position, added_at: now }),
		{ status: 201 }
	)
}

export const PUT: RequestHandler = async ({ params, request, cookies }) => {
	let body: { order: string[] }
	try {
		body = await request.json()
	} catch {
		error(400, 'Invalid JSON body')
	}

	if (!Array.isArray(body.order)) error(400, 'order must be an array of climb UUIDs')

	await resolveOwnedPlaylist(cookies, params.id)

	// Update each item's position — uuid at index i gets position i
	await db.transaction(async (tx) => {
		for (let i = 0; i < body.order.length; i++) {
			await tx
				.update(playlistItems)
				.set({ position: i })
				.where(eq(playlistItems.climb_uuid, body.order[i]))
		}
	})

	const items = await loadPlaylistItems(params.id)
	return json(items.map(itemToJson))
}
