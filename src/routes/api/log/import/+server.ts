/**
 * POST /api/log/import
 *
 * Merges the anonymous user's log rows into the authenticated user's account.
 * Merge strategy:
 *   - ticked:        OR  (true wins)
 *   - liked:         OR  (true wins)
 *   - attempt_count: SUM
 *   - last_lit_at:   GREATEST (most recent wins)
 *
 * After merge, deletes the anonymous user's log rows (the anon user row itself
 * is kept so the cookie doesn't recreate it, but its log is cleared).
 * Sets users.anon_id on the authenticated user to the cookie value so future
 * writes go directly to the right account.
 */

import { error, json } from '@sveltejs/kit'
import { and, eq, sql } from 'drizzle-orm'
import { db } from '$lib/server/db'
import { userLog, users } from '$lib/server/db/schema'
import type { RequestHandler } from './$types'

const ANON_COOKIE = 'kb_anon_id'

export const POST: RequestHandler = async ({ locals, cookies }) => {
	if (!locals.user) error(401, 'Not authenticated')

	const anonId = cookies.get(ANON_COOKIE)
	if (!anonId) return json({ ok: true, merged: 0 })

	// Find the anonymous user row
	const anonUser = await db
		.select({ id: users.id })
		.from(users)
		.where(eq(users.anon_id, anonId))
		.limit(1)

	if (anonUser.length === 0) return json({ ok: true, merged: 0 })
	const anonUserId = anonUser[0].id

	// Same user — nothing to merge
	if (anonUserId === locals.user.id) return json({ ok: true, merged: 0 })

	// Get all anon log rows
	const anonRows = await db.select().from(userLog).where(eq(userLog.user_id, anonUserId))

	if (anonRows.length === 0) return json({ ok: true, merged: 0 })

	// Upsert each row into the authenticated user's account with merge strategy
	for (const row of anonRows) {
		await db
			.insert(userLog)
			.values({
				user_id: locals.user.id,
				climb_uuid: row.climb_uuid,
				angle: row.angle,
				ticked: row.ticked,
				attempt_count: row.attempt_count,
				liked: row.liked,
				last_lit_at: row.last_lit_at,
				updated_at: new Date()
			})
			.onConflictDoUpdate({
				target: [userLog.user_id, userLog.climb_uuid, userLog.angle],
				set: {
					// OR for booleans (true wins)
					ticked: sql`${userLog.ticked} OR EXCLUDED.ticked`,
					liked: sql`${userLog.liked} OR EXCLUDED.liked`,
					// SUM for attempt_count
					attempt_count: sql`${userLog.attempt_count} + EXCLUDED.attempt_count`,
					// GREATEST for timestamps
					last_lit_at: sql`GREATEST(${userLog.last_lit_at}, EXCLUDED.last_lit_at)`,
					updated_at: new Date()
				}
			})
	}

	// Delete the anon user's log rows (they've been merged)
	await db.delete(userLog).where(eq(userLog.user_id, anonUserId))

	// Associate the authenticated user's account with this anon_id going forward
	// (so the same cookie maps directly to the real user next time)
	await db
		.update(users)
		.set({ anon_id: anonId })
		.where(and(eq(users.id, locals.user.id)))

	return json({ ok: true, merged: anonRows.length })
}
