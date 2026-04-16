/**
 * GET /api/climbs/:uuid — fetch a single climb with all its stats.
 *
 * Query parameters:
 *   angle  number  (optional) If provided, the activeStats field will prefer
 *                  the record for that angle over the best overall record.
 *
 * Response: ClimbWithStats | 404
 */

import { error, json } from '@sveltejs/kit'
import { desc, eq } from 'drizzle-orm'
import type { Climb, ClimbStats, ClimbWithStats } from '$lib/data/types'
import { db } from '$lib/server/db'
import { climbStats, climbs } from '$lib/server/db/schema'
import type { RequestHandler } from './$types'

export const GET: RequestHandler = async ({ params, url }) => {
	const { uuid } = params
	const angleParam = url.searchParams.get('angle')
	const angle = angleParam !== null ? Number(angleParam) : null

	// Fetch the climb row
	const climbRows = await db.select().from(climbs).where(eq(climbs.uuid, uuid)).limit(1)
	if (climbRows.length === 0) error(404, 'Climb not found')

	const climbRow = climbRows[0]

	// Fetch all stats rows for this climb
	const statsRows = await db
		.select()
		.from(climbStats)
		.where(eq(climbStats.climb_uuid, uuid))
		.orderBy(desc(climbStats.ascent_count))

	const climb: Climb = {
		uuid: climbRow.uuid,
		layout_id: climbRow.layout_id,
		setter_id: climbRow.setter_id,
		setter_username: climbRow.setter_username,
		name: climbRow.name,
		description: climbRow.description ?? '',
		frames: climbRow.frames,
		frames_count: climbRow.frames_count ?? 0,
		angle: climbRow.angle,
		is_draft: climbRow.is_draft,
		allow_matches: climbRow.allow_matches,
		is_campus: !climbRow.allow_matches,
		is_route: (climbRow.frames_count ?? 0) > 1
	}

	const stats: ClimbStats[] = statsRows.map((s) => ({
		climb_uuid: s.climb_uuid,
		angle: s.angle,
		difficulty_average: s.difficulty_average,
		benchmark_difficulty: s.benchmark_difficulty,
		quality_average: s.quality_average,
		ascent_count: s.ascent_count
	}))

	// Pick the activeStats: prefer the requested angle, fall back to best overall
	let activeStats: ClimbStats | null = null
	if (angle !== null) activeStats = stats.find((s) => s.angle === angle) ?? null
	if (!activeStats) {
		const benchmark = stats.find((s) => s.benchmark_difficulty !== null)
		activeStats =
			benchmark ??
			stats.reduce<ClimbStats | null>(
				(best, s) => (best === null || s.ascent_count > best.ascent_count ? s : best),
				null
			)
	}

	const result: ClimbWithStats = { climb, stats, activeStats }
	return json(result)
}
