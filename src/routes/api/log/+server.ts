/**
 * /api/log — user climb log persistence.
 *
 * GET  /api/log?angle=<n>
 *   Returns all user_log rows for the caller's user ID at that angle.
 *   Response: Record<string, LogEntry>  (keys = `${uuid}@${angle}`)
 *
 * POST /api/log
 *   Body: { climbUuid: string, angle: number, patch: Partial<LogEntry> }
 *   Upserts the user_log row. Returns the updated entry.
 *
 * The "user" is resolved by anon_id cookie (always present).
 * If the user has a real account the same row is used (anon_id is on the users table).
 */

import { error, json } from '@sveltejs/kit'
import { and, eq } from 'drizzle-orm'
import { db } from '$lib/server/db'
import { userLog } from '$lib/server/db/schema'
import { resolveUserId } from '$lib/server/users'
import type { RequestHandler } from './$types'

const ANON_COOKIE = 'kb_anon_id'

/** LogEntry shape (mirrors log-service.ts). */
interface LogEntry {
	ticked: boolean
	attemptCount: number
	liked: boolean
	lastLitAt?: string | null
}

function rowToEntry(row: {
	ticked: boolean
	attempt_count: number
	liked: boolean
	last_lit_at: Date | null
}): LogEntry {
	return {
		ticked: row.ticked,
		attemptCount: row.attempt_count,
		liked: row.liked,
		lastLitAt: row.last_lit_at ? row.last_lit_at.toISOString() : null
	}
}

export const GET: RequestHandler = async ({ url, cookies }) => {
	const anonId = cookies.get(ANON_COOKIE)
	if (!anonId) return json({})

	const angleStr = url.searchParams.get('angle')
	if (!angleStr) error(400, 'angle parameter required')
	const angle = Number(angleStr)
	if (Number.isNaN(angle)) error(400, 'angle must be a number')

	const userId = await resolveUserId(anonId)

	const rows = await db
		.select()
		.from(userLog)
		.where(and(eq(userLog.user_id, userId), eq(userLog.angle, angle)))

	const result: Record<string, LogEntry> = {}
	for (const row of rows) {
		result[`${row.climb_uuid}@${angle}`] = rowToEntry(row)
	}

	return json(result)
}

export const POST: RequestHandler = async ({ request, cookies }) => {
	const anonId = cookies.get(ANON_COOKIE)
	if (!anonId) error(401, 'No anonymous ID cookie')

	let body: { climbUuid: string; angle: number; patch: Partial<LogEntry> }
	try {
		body = await request.json()
	} catch {
		error(400, 'Invalid JSON body')
	}

	const { climbUuid, angle, patch } = body
	if (!climbUuid || typeof angle !== 'number') error(400, 'climbUuid and angle are required')

	const userId = await resolveUserId(anonId)

	// Build the upsert values from the patch
	const upsertValues: {
		user_id: string
		climb_uuid: string
		angle: number
		ticked?: boolean
		attempt_count?: number
		liked?: boolean
		last_lit_at?: Date | null
		updated_at: Date
	} = {
		user_id: userId,
		climb_uuid: climbUuid,
		angle,
		updated_at: new Date()
	}

	if (patch.ticked !== undefined) upsertValues.ticked = patch.ticked
	if (patch.attemptCount !== undefined) upsertValues.attempt_count = patch.attemptCount
	if (patch.liked !== undefined) upsertValues.liked = patch.liked
	if (patch.lastLitAt !== undefined) {
		upsertValues.last_lit_at = patch.lastLitAt ? new Date(patch.lastLitAt) : null
	}

	await db
		.insert(userLog)
		.values({
			user_id: userId,
			climb_uuid: climbUuid,
			angle,
			ticked: patch.ticked ?? false,
			attempt_count: patch.attemptCount ?? 0,
			liked: patch.liked ?? false,
			last_lit_at: patch.lastLitAt ? new Date(patch.lastLitAt) : null,
			updated_at: new Date()
		})
		.onConflictDoUpdate({
			target: [userLog.user_id, userLog.climb_uuid, userLog.angle],
			set: {
				...(patch.ticked !== undefined && { ticked: patch.ticked }),
				...(patch.attemptCount !== undefined && { attempt_count: patch.attemptCount }),
				...(patch.liked !== undefined && { liked: patch.liked }),
				...(patch.lastLitAt !== undefined && {
					last_lit_at: patch.lastLitAt ? new Date(patch.lastLitAt) : null
				}),
				updated_at: new Date()
			}
		})

	// Return the current state
	const rows = await db
		.select()
		.from(userLog)
		.where(
			and(eq(userLog.user_id, userId), eq(userLog.climb_uuid, climbUuid), eq(userLog.angle, angle))
		)
		.limit(1)

	if (rows.length === 0) error(500, 'Failed to upsert log entry')

	return json(rowToEntry(rows[0]))
}
