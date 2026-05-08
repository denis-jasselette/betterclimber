import { and, desc, eq, gt, gte, ilike, isNotNull, lte, or, type SQLWrapper } from 'drizzle-orm'
import { db } from '$lib/server/db'
import { climbStats, climbs } from '$lib/server/db/schema'
import {
	type Angle,
	type Climb,
	type ClimbFilters,
	type ClimbStats,
	type ClimbWithStats,
	gradeToDifficulty
} from './types'

const DEFAULT_LIMIT = 50
const MAX_LIMIT = 200

export async function searchClimbs(
	angle: Angle,
	filters: Partial<ClimbFilters> = {},
	cursor: number = 0,
	limit: number = DEFAULT_LIMIT
) {
	limit = Math.min(limit, MAX_LIMIT)

	const statsConditions: Array<SQLWrapper | undefined> = [eq(climbStats.climb_uuid, climbs.uuid)]

	statsConditions.push(eq(climbStats.angle, angle))
	if (filters.gradeMin)
		statsConditions.push(gte(climbStats.difficulty_average, gradeToDifficulty(filters.gradeMin)))
	if (filters.gradeMax)
		statsConditions.push(lte(climbStats.difficulty_average, gradeToDifficulty(filters.gradeMax)))
	if (filters.minQuality) statsConditions.push(gte(climbStats.quality_average, filters.minQuality))
	if (filters.onlyBenchmarks) statsConditions.push(isNotNull(climbStats.benchmark_difficulty))

	// ── Climb-level conditions ──────────────────────────────────────────────────
	const climbConditions: Array<SQLWrapper | undefined> = [eq(climbs.is_draft, false)]

	if (filters.query) {
		const queryPattern = `%${filters.query.split(/\s+/).join('%')}%`
		const textFilter = or(
			ilike(climbs.name, queryPattern),
			ilike(climbs.setter_username, queryPattern)
		)
		climbConditions.push(textFilter)
	}
	if (filters.onlyCampus) climbConditions.push(eq(climbs.allow_matches, false))
	if (filters.onlyRoutes) climbConditions.push(gt(climbs.frames_count, 1))

	// ── Execute query ───────────────────────────────────────────────────────────
	// We join climbs with their "best" stats row for this angle/filter combo.
	// Using DISTINCT ON to pick one stats row per climb.
	const rows = await db
		.select({
			// Climb fields
			uuid: climbs.uuid,
			layout_id: climbs.layout_id,
			setter_id: climbs.setter_id,
			setter_username: climbs.setter_username,
			name: climbs.name,
			description: climbs.description,
			frames: climbs.frames,
			frames_count: climbs.frames_count,
			angle: climbs.angle,
			is_draft: climbs.is_draft,
			allow_matches: climbs.allow_matches,
			// Stats fields (the "active" stats row for sorting/display)
			stat_angle: climbStats.angle,
			difficulty_average: climbStats.difficulty_average,
			benchmark_difficulty: climbStats.benchmark_difficulty,
			quality_average: climbStats.quality_average,
			ascent_count: climbStats.ascent_count
		})
		.from(climbs)
		.innerJoin(climbStats, and(...statsConditions))
		.where(and(...climbConditions))
		.orderBy(desc(climbStats.quality_average), desc(climbStats.ascent_count), climbs.uuid)
		.limit(limit + 1) // fetch one extra to detect next page
		.offset(cursor)

	// ── Shape results ───────────────────────────────────────────────────────────
	const hasMore = rows.length > limit
	const pageRows = hasMore ? rows.slice(0, limit) : rows
	const nextCursor = hasMore ? cursor + limit : null

	const result: ClimbWithStats[] = pageRows.map((row) => {
		const climb: Climb = {
			uuid: row.uuid,
			layout_id: row.layout_id,
			setter_id: row.setter_id,
			setter_username: row.setter_username,
			name: row.name,
			description: row.description ?? '',
			frames: row.frames,
			frames_count: row.frames_count ?? 0,
			angle: row.angle,
			is_draft: row.is_draft,
			allow_matches: row.allow_matches,
			is_campus: !row.allow_matches,
			is_route: (row.frames_count ?? 0) > 1
		}

		const activeStats: ClimbStats = {
			climb_uuid: row.uuid,
			angle: row.stat_angle,
			difficulty_average: row.difficulty_average,
			benchmark_difficulty: row.benchmark_difficulty,
			quality_average: row.quality_average,
			ascent_count: row.ascent_count
		}

		return { climb, stats: [activeStats], activeStats }
	})

	return { climbs: result, nextCursor }
}
