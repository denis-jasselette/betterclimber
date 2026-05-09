/**
 * GET /api/log/import-status
 *
 * Returns { hasPending: boolean } — true if the authenticated user's
 * anonymous account has user_log rows that haven't been merged yet.
 * Only meaningful after sign-in (when user.anon_id still points to the
 * old anonymous account's rows).
 */

import { json } from '@sveltejs/kit'
import { and, eq } from 'drizzle-orm'
import { db } from '$lib/server/db'
import { userLog, users } from '$lib/server/db/schema'
import type { RequestHandler } from './$types'

const ANON_COOKIE = 'kb_anon_id'

export const GET: RequestHandler = async ({ locals, cookies }) => {
	// Not signed in — no pending import
	if (!locals.user) return json({ hasPending: false })

	const anonId = cookies.get(ANON_COOKIE)
	if (!anonId) return json({ hasPending: false })

	// Find the anonymous user row for this cookie (if any)
	const anonUser = await db
		.select({ id: users.id })
		.from(users)
		.where(and(eq(users.anon_id, anonId)))
		.limit(1)

	if (anonUser.length === 0) return json({ hasPending: false })
	const anonUserId = anonUser[0].id

	// Don't prompt if the anon user IS the authenticated user
	if (anonUserId === locals.user.id) return json({ hasPending: false })

	// Check if the anon account has any log rows
	const rows = await db
		.select({ user_id: userLog.user_id })
		.from(userLog)
		.where(eq(userLog.user_id, anonUserId))
		.limit(1)

	return json({ hasPending: rows.length > 0 })
}
