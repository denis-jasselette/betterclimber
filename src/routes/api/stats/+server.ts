/**
 * /api/stats — aggregated training statistics for the calling user.
 *
 * GET /api/stats
 *   Returns:
 *   - heatmap: { date: string (YYYY-MM-DD), count: number }[] — activity per day for the last 52 weeks
 *     "Activity" = number of log entries updated on that day (any tick, attempt, or lit action)
 *   - gradeDistribution: { grade: string, count: number }[] — ticked climbs per V-grade
 *
 * User resolved by anon_id cookie (always present).
 */

import { json } from '@sveltejs/kit'
import { and, eq, gte, isNotNull } from 'drizzle-orm'
import { DIFFICULTY_GRADES } from '$lib/data/types'
import { db } from '$lib/server/db'
import { climbStats, climbs, userLog, users } from '$lib/server/db/schema'
import type { RequestHandler } from './$types'

const ANON_COOKIE = 'kb_anon_id'

async function resolveUserId(anonId: string): Promise<string | null> {
	const existing = await db
		.select({ id: users.id })
		.from(users)
		.where(eq(users.anonId, anonId))
		.limit(1)

	return existing.length > 0 ? existing[0].id : null
}

/** Map numeric difficulty to V-grade label (mirrors types.ts). */
function toGrade(difficulty: number): string {
	const rounded = Math.round(difficulty)
	const found = DIFFICULTY_GRADES.find((g) => g.difficulty === rounded)
	return found?.boulder_name ?? 'V?'
}

export const GET: RequestHandler = async ({ cookies }) => {
	const anonId = cookies.get(ANON_COOKIE)
	if (!anonId) return json({ heatmap: [], gradeDistribution: [] })

	const userId = await resolveUserId(anonId)
	if (!userId) return json({ heatmap: [], gradeDistribution: [] })

	// ── Heatmap: activity per day for the last 52 weeks ──────────────────────
	const since = new Date()
	since.setDate(since.getDate() - 7 * 52)

	const logRows = await db
		.select({ updated_at: userLog.updated_at })
		.from(userLog)
		.where(and(eq(userLog.user_id, userId), gte(userLog.updated_at, since)))

	// Aggregate by date (YYYY-MM-DD)
	const dayCounts = new Map<string, number>()
	for (const row of logRows) {
		if (!row.updated_at) continue
		const d = row.updated_at.toISOString().slice(0, 10)
		dayCounts.set(d, (dayCounts.get(d) ?? 0) + 1)
	}
	const heatmap = [...dayCounts.entries()]
		.map(([date, count]) => ({ date, count }))
		.sort((a, b) => a.date.localeCompare(b.date))

	// ── Grade distribution: ticked climbs grouped by V-grade ─────────────────
	const tickedRows = await db
		.select({
			difficulty_average: climbStats.difficulty_average,
			angle: climbStats.angle,
			log_angle: userLog.angle
		})
		.from(userLog)
		.innerJoin(climbs, eq(climbs.uuid, userLog.climb_uuid))
		.innerJoin(
			climbStats,
			and(eq(climbStats.climb_uuid, userLog.climb_uuid), eq(climbStats.angle, userLog.angle))
		)
		.where(and(eq(userLog.user_id, userId), eq(userLog.ticked, true), isNotNull(userLog.ticked_at)))

	const gradeCounts = new Map<string, number>()
	for (const row of tickedRows) {
		const grade = toGrade(row.difficulty_average)
		gradeCounts.set(grade, (gradeCounts.get(grade) ?? 0) + 1)
	}

	// Return in grade order (V0 → V17)
	const gradeOrder = [...new Set(DIFFICULTY_GRADES.map((g) => g.boulder_name))]
	const gradeDistribution = gradeOrder
		.filter((g) => gradeCounts.has(g))
		.map((grade) => ({ grade, count: gradeCounts.get(grade) ?? 0 }))

	return json({ heatmap, gradeDistribution })
}
