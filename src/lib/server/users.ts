/**
 * Shared user resolution helper for API endpoints.
 */

import { eq } from 'drizzle-orm'
import { db } from '$lib/server/db'
import { users } from '$lib/server/db/schema'

/** Resolve (or create) a user row for the given anon_id. Returns the user id. */
export async function resolveUserId(anonId: string): Promise<string> {
	const existing = await db
		.select({ id: users.id })
		.from(users)
		.where(eq(users.anonId, anonId))
		.limit(1)

	if (existing.length > 0) return existing[0].id

	const newId = crypto.randomUUID()
	await db.insert(users).values({ id: newId, anonId })
	return newId
}
