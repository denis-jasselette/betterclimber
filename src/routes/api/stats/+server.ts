/**
 * /api/stats — aggregated training statistics for the calling user.
 *
 * GET /api/stats[?from=YYYY-MM-DD&to=YYYY-MM-DD]
 *   Optional query params:
 *     from  — start of date range (inclusive), applied to ticked_at / updated_at
 *     to    — end of date range (inclusive)
 *
 *   Returns:
 *   - heatmap:          { date, count }[]           — 52-week activity grid (always full range)
 *   - gradeDistribution: { grade, ticked, attempted }[] — grade breakdown, filtered by range
 *   - totalAttempts:    number                      — sum of attempt counts in range
 *   - personalBests:    { highestFlashed, highestTicked, avgAttemptsPerDay }
 *
 * User resolved by anon_id cookie (always present).
 */

import { json } from '@sveltejs/kit'
import { and, eq, gte, isNotNull, lte } from 'drizzle-orm'
import { DIFFICULTY_GRADES } from '$lib/data/types'
import { db } from '$lib/server/db'
import { climbStats, userLog, users } from '$lib/server/db/schema'
import type { RequestHandler } from './$types'

const ANON_COOKIE = 'kb_anon_id'

// V-grade labels in ascending order (V0 → V17)
const GRADE_ORDER = [...new Set(DIFFICULTY_GRADES.map((g) => g.boulder_name))]

async function resolveUserId(anonId: string): Promise<string | null> {
	const existing = await db
		.select({ id: users.id })
		.from(users)
		.where(eq(users.anonId, anonId))
		.limit(1)
	return existing.length > 0 ? existing[0].id : null
}

function toGrade(difficulty: number): string {
	const rounded = Math.round(difficulty)
	const found = DIFFICULTY_GRADES.find((g) => g.difficulty === rounded)
	return found?.boulder_name ?? 'V?'
}

const EMPTY_RESPONSE = {
	heatmap: [],
	gradeDistribution: [],
	totalAttempts: 0,
	personalBests: {
		highestFlashed: null as string | null,
		highestTicked: null as string | null,
		avgAttemptsPerDay: null as number | null
	}
}

export const GET: RequestHandler = async ({ cookies, url }) => {
	const anonId = cookies.get(ANON_COOKIE)
	if (!anonId) return json(EMPTY_RESPONSE)

	const userId = await resolveUserId(anonId)
	if (!userId) return json(EMPTY_RESPONSE)

	// ── Parse optional date range ─────────────────────────────────────────────
	const fromParam = url.searchParams.get('from')
	const toParam = url.searchParams.get('to')
	const fromDate = fromParam ? new Date(`${fromParam}T00:00:00Z`) : null
	const toDate = toParam ? new Date(`${toParam}T23:59:59Z`) : null

	// ── Heatmap: always last 52 weeks regardless of range ────────────────────
	const heatmapSince = new Date()
	heatmapSince.setDate(heatmapSince.getDate() - 7 * 52)

	const heatmapRows = await db
		.select({ updated_at: userLog.updated_at })
		.from(userLog)
		.where(and(eq(userLog.user_id, userId), gte(userLog.updated_at, heatmapSince)))

	const dayCounts = new Map<string, number>()
	for (const row of heatmapRows) {
		if (!row.updated_at) continue
		const d = row.updated_at.toISOString().slice(0, 10)
		dayCounts.set(d, (dayCounts.get(d) ?? 0) + 1)
	}
	const heatmap = [...dayCounts.entries()]
		.map(([date, count]) => ({ date, count }))
		.sort((a, b) => a.date.localeCompare(b.date))

	// ── All log rows with grade info, filtered by time range ─────────────────
	const rangeConditions = [eq(userLog.user_id, userId)]
	if (fromDate) rangeConditions.push(gte(userLog.updated_at, fromDate))
	if (toDate) rangeConditions.push(lte(userLog.updated_at, toDate))

	// For ticked metrics, additionally constrain by ticked_at when range is set
	const tickedRangeConditions = [
		eq(userLog.user_id, userId),
		eq(userLog.ticked, true),
		isNotNull(userLog.ticked_at)
	]
	if (fromDate) tickedRangeConditions.push(gte(userLog.ticked_at, fromDate))
	if (toDate) tickedRangeConditions.push(lte(userLog.ticked_at, toDate))

	const [allRows, tickedRows] = await Promise.all([
		// All rows in range (for attempts, attempted-but-not-ticked)
		db
			.select({
				difficulty_average: climbStats.difficulty_average,
				ticked: userLog.ticked,
				attempt_count: userLog.attempt_count,
				updated_at: userLog.updated_at
			})
			.from(userLog)
			.innerJoin(
				climbStats,
				and(eq(climbStats.climb_uuid, userLog.climb_uuid), eq(climbStats.angle, userLog.angle))
			)
			.where(and(...rangeConditions)),

		// Ticked rows filtered by ticked_at (for grade distribution ticked segment + personal bests)
		db
			.select({
				difficulty_average: climbStats.difficulty_average,
				attempt_count: userLog.attempt_count
			})
			.from(userLog)
			.innerJoin(
				climbStats,
				and(eq(climbStats.climb_uuid, userLog.climb_uuid), eq(climbStats.angle, userLog.angle))
			)
			.where(and(...tickedRangeConditions))
	])

	// ── totalAttempts ─────────────────────────────────────────────────────────
	let totalAttempts = 0
	const activeDays = new Set<string>()
	const gradeAttempted = new Map<string, number>()

	for (const row of allRows) {
		totalAttempts += row.attempt_count
		if (row.updated_at) {
			activeDays.add(row.updated_at.toISOString().slice(0, 10))
		}
		if (!row.ticked && row.attempt_count > 0) {
			const grade = toGrade(row.difficulty_average)
			gradeAttempted.set(grade, (gradeAttempted.get(grade) ?? 0) + 1)
		}
	}

	// ── Grade distribution ────────────────────────────────────────────────────
	const gradeTicked = new Map<string, number>()

	for (const row of tickedRows) {
		const grade = toGrade(row.difficulty_average)
		gradeTicked.set(grade, (gradeTicked.get(grade) ?? 0) + 1)
	}

	const allGradeKeys = new Set([...gradeTicked.keys(), ...gradeAttempted.keys()])
	const gradeDistribution = GRADE_ORDER.filter((g) => allGradeKeys.has(g)).map((grade) => ({
		grade,
		ticked: gradeTicked.get(grade) ?? 0,
		attempted: gradeAttempted.get(grade) ?? 0
	}))

	// ── Personal bests ────────────────────────────────────────────────────────
	const tickedGradesSorted = [...gradeTicked.keys()].sort(
		(a, b) => GRADE_ORDER.indexOf(b) - GRADE_ORDER.indexOf(a)
	)
	const highestTicked = tickedGradesSorted[0] ?? null

	const flashedGrades = tickedRows
		.filter((r) => r.attempt_count === 0)
		.map((r) => toGrade(r.difficulty_average))

	const highestFlashedIdx = flashedGrades.reduce((best, g) => {
		const idx = GRADE_ORDER.indexOf(g)
		return idx > best ? idx : best
	}, -1)
	const highestFlashed = highestFlashedIdx >= 0 ? GRADE_ORDER[highestFlashedIdx] : null

	const avgAttemptsPerDay =
		activeDays.size > 0 ? Math.round((totalAttempts / activeDays.size) * 10) / 10 : null

	return json({
		heatmap,
		gradeDistribution,
		totalAttempts,
		personalBests: { highestFlashed, highestTicked, avgAttemptsPerDay }
	})
}
