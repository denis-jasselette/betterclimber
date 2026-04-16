/**
 * GET /api/climbs — paginated climb search backed by Neon PostgreSQL.
 *
 * Query parameters:
 *   angle        number        Filter to climbs with stats at this angle
 *   gradeMin     number        Minimum difficulty_average (numeric, inclusive)
 *   gradeMax     number        Maximum difficulty_average (numeric, inclusive)
 *   minQuality   number        Minimum quality_average (0–3, default 0)
 *   query        string        Text search on name and setter_username (ILIKE)
 *   onlyBenchmarks 1|0        Only climbs with a non-null benchmark_difficulty
 *   limit        number        Page size (default 50, max 200)
 *   cursor       string        Opaque cursor for the next page (base64 JSON)
 *
 * Response: { climbs: ClimbWithStats[], nextCursor: string | null }
 *
 * Sort: quality_average DESC, ascent_count DESC, uuid ASC (stable for cursor pagination)
 */

import { json } from '@sveltejs/kit'
import { and, desc, eq, gte, ilike, isNotNull, lte, or, sql } from 'drizzle-orm'
import type { Climb, ClimbStats, ClimbWithStats } from '$lib/data/types'
import { db } from '$lib/server/db'
import { climbStats, climbs } from '$lib/server/db/schema'
import type { RequestHandler } from './$types'

const DEFAULT_LIMIT = 50
const MAX_LIMIT = 200

interface Cursor {
	quality: number
	ascents: number
	uuid: string
}

function encodeCursor(c: Cursor): string {
	return Buffer.from(JSON.stringify(c)).toString('base64url')
}

function decodeCursor(s: string): Cursor | null {
	try {
		return JSON.parse(Buffer.from(s, 'base64url').toString('utf-8')) as Cursor
	} catch {
		return null
	}
}

export const GET: RequestHandler = async ({ url }) => {
	const p = url.searchParams

	const angle = p.has('angle') ? Number(p.get('angle')) : null
	const gradeMin = p.has('gradeMin') ? Number(p.get('gradeMin')) : null
	const gradeMax = p.has('gradeMax') ? Number(p.get('gradeMax')) : null
	const minQuality = p.has('minQuality') ? Number(p.get('minQuality')) : 0
	const query = p.get('query')?.trim() ?? ''
	const onlyBenchmarks = p.get('onlyBenchmarks') === '1'
	const limit = Math.min(Number(p.get('limit') ?? DEFAULT_LIMIT), MAX_LIMIT)
	const cursorStr = p.get('cursor')
	const cursor = cursorStr ? decodeCursor(cursorStr) : null

	// ── Build the stats sub-query conditions ────────────────────────────────────
	const statsConditions = [eq(climbStats.climb_uuid, climbs.uuid)]

	if (angle !== null) statsConditions.push(eq(climbStats.angle, angle))
	if (gradeMin !== null) statsConditions.push(gte(climbStats.difficulty_average, gradeMin))
	if (gradeMax !== null) statsConditions.push(lte(climbStats.difficulty_average, gradeMax))
	if (minQuality > 0) statsConditions.push(gte(climbStats.quality_average, minQuality))
	if (onlyBenchmarks) statsConditions.push(isNotNull(climbStats.benchmark_difficulty))

	// ── Climb-level conditions ──────────────────────────────────────────────────
	const climbConditions = [eq(climbs.is_draft, false)]

	if (query) {
		const textFilter = or(
			ilike(climbs.name, `%${query}%`),
			ilike(climbs.setter_username, `%${query}%`)
		)
		// biome-ignore lint/style/noNonNullAssertion: or() with 2 args always returns a value
		climbConditions.push(textFilter!)
	}

	// Cursor-based pagination (WHERE quality < prev OR (quality = prev AND ascents < prev) OR ...)
	if (cursor) {
		const cursorFilter = or(
			sql`${climbStats.quality_average} < ${cursor.quality}`,
			and(
				sql`${climbStats.quality_average} = ${cursor.quality}`,
				sql`${climbStats.ascent_count} < ${cursor.ascents}`
			),
			and(
				sql`${climbStats.quality_average} = ${cursor.quality}`,
				sql`${climbStats.ascent_count} = ${cursor.ascents}`,
				sql`${climbs.uuid} > ${cursor.uuid}`
			)
		)
		// biome-ignore lint/style/noNonNullAssertion: or() with 3 args always returns a value
		climbConditions.push(cursorFilter!)
	}

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

	// ── Shape results ───────────────────────────────────────────────────────────
	const hasMore = rows.length > limit
	const pageRows = hasMore ? rows.slice(0, limit) : rows

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
			// Not in real DB — always false
			is_campus: false,
			is_route: false
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

	// Build next cursor from the last row
	const lastRow = pageRows.at(-1)
	const nextCursor =
		hasMore && lastRow
			? encodeCursor({
					quality: lastRow.quality_average,
					ascents: lastRow.ascent_count,
					uuid: lastRow.uuid
				})
			: null

	return json({ climbs: result, nextCursor })
}
