/**
 * Data Access Layer — Repository
 *
 * This is the ONLY file that knows where data comes from.
 * Currently backed by static mock JSON. To switch to the real Kilter API:
 *   1. Implement a SvelteKit `+server.ts` that calls the Kilter /sync endpoint
 *      and writes to a local SQLite DB (e.g. via Drizzle ORM + better-sqlite3).
 *   2. Replace the `import` statements below with `fetch('/api/...')` calls.
 *   3. No changes needed anywhere else in the app.
 *
 * Public API (never changes regardless of backing store):
 *   searchClimbs(filters)   → Promise<ClimbWithStats[]>
 *   getClimb(uuid)          → Promise<ClimbWithStats | null>
 *   resolveHolds(climb)     → Promise<ResolvedHold[]>
 */

import { parseFrames } from './frames-parser';
import { getUuidsWhere } from './log-service';
import type {
	Climb,
	ClimbFilters,
	ClimbStats,
	ClimbWithStats,
	Led,
	Placement,
	ResolvedHold
} from './types';
import { DIFFICULTY_GRADES } from './types';

// ── Mock data imports ────────────────────────────────────────────────────────
import climbStatsJson from './mock/climb-stats.json';
import climbsJson from './mock/climbs.json';
import ledsJson from './mock/leds.json';
import placementsJson from './mock/placements.json';

// Cast the raw JSON to typed arrays
const allClimbs = climbsJson as Climb[];
const allStats = climbStatsJson as ClimbStats[];
const allPlacements = placementsJson as Placement[];
const allLeds = ledsJson as Led[];

// ── Index maps for O(1) lookups ───────────────────────────────────────────────

/** placement_id → Led.position */
const ledByPlacementId = new Map<number, number>();
{
	// Build: placement → hole_id, hole_id → led.position
	const holeToLedPos = new Map<number, number>(allLeds.map((l) => [l.hole_id, l.position]));
	for (const p of allPlacements) {
		const pos = holeToLedPos.get(p.hole_id);
		if (pos !== undefined) ledByPlacementId.set(p.id, pos);
	}
}

/** climb_uuid → ClimbStats[] */
const statsByClimbUuid = new Map<string, ClimbStats[]>();
for (const s of allStats) {
	const arr = statsByClimbUuid.get(s.climb_uuid) ?? [];
	arr.push(s);
	statsByClimbUuid.set(s.climb_uuid, arr);
}

// ── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Pick the best overall stats record for a climb (ignoring angle preference).
 * Prefers a benchmark record, otherwise highest ascent count.
 */
function pickBestStats(stats: ClimbStats[]): ClimbStats | null {
	if (stats.length === 0) return null;
	const benchmark = stats.find((s) => s.benchmark_difficulty !== null);
	if (benchmark) return benchmark;
	return stats.reduce((best, s) => (s.ascent_count > best.ascent_count ? s : best), stats[0]);
}

/**
 * Return the stats record for the given angle, or fall back to the best overall.
 * This is what should be shown on cards when an angle is selected.
 */
function pickActiveStats(stats: ClimbStats[], angle: number | null): ClimbStats | null {
	if (angle !== null) {
		const atAngle = stats.find((s) => s.angle === angle);
		if (atAngle) return atAngle;
	}
	return pickBestStats(stats);
}

function joinClimb(climb: Climb, angle: number | null): ClimbWithStats {
	const stats = statsByClimbUuid.get(climb.uuid) ?? [];
	return { climb, stats, activeStats: pickActiveStats(stats, angle) };
}

// ── Grade range helpers ───────────────────────────────────────────────────────

/** Minimum numeric difficulty for a given V-grade label. */
function gradeToMinDifficulty(grade: string): number {
	const matches = DIFFICULTY_GRADES.filter((g) => g.boulder_name === grade);
	if (matches.length === 0) return 0;
	return Math.min(...matches.map((g) => g.difficulty));
}

/** Maximum numeric difficulty for a given V-grade label. */
function gradeToMaxDifficulty(grade: string): number {
	const matches = DIFFICULTY_GRADES.filter((g) => g.boulder_name === grade);
	if (matches.length === 0) return Infinity;
	return Math.max(...matches.map((g) => g.difficulty));
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Search and filter climbs.
 * `angle` is passed separately — it is not part of ClimbFilters so it is
 * never reset by "Clear filters".
 */
export async function searchClimbs(
	filters: Partial<ClimbFilters> = {},
	angle: number | null = null
): Promise<ClimbWithStats[]> {
	const {
		gradeMin = null,
		gradeMax = null,
		minQuality = 0,
		query = '',
		excludeTicked = false,
		onlyAttempted = false,
		onlyLiked = false,
		onlyBenchmarks = false,
		onlyCampus = false,
		onlyRoutes = false,
		onlyRecentlyLit = false
	} = filters;

	const queryLower = query.trim().toLowerCase();

	// Pre-load user log sets (sync, from localStorage)
	const tickedUuids = excludeTicked ? getUuidsWhere((e) => e.ticked) : new Set<string>();
	const attemptedUuids = onlyAttempted
		? getUuidsWhere((e) => e.attemptCount > 0)
		: new Set<string>();
	const likedUuids = onlyLiked ? getUuidsWhere((e) => e.liked) : new Set<string>();
	const litUuids = onlyRecentlyLit ? getUuidsWhere((e) => !!e.lastLitAt) : new Set<string>();

	// Pre-compute grade range as numeric difficulty bounds
	const diffMin = gradeMin !== null ? gradeToMinDifficulty(gradeMin) : -Infinity;
	const diffMax = gradeMax !== null ? gradeToMaxDifficulty(gradeMax) : Infinity;
	const hasGradeFilter = gradeMin !== null || gradeMax !== null;

	const results: ClimbWithStats[] = [];

	for (const climb of allClimbs) {
		if (climb.is_draft) continue;

		// User-log exclusions / inclusions
		if (excludeTicked && tickedUuids.has(climb.uuid)) continue;
		if (onlyAttempted && !attemptedUuids.has(climb.uuid)) continue;
		if (onlyLiked && !likedUuids.has(climb.uuid)) continue;
		if (onlyRecentlyLit && !litUuids.has(climb.uuid)) continue;

		// Text search
		if (queryLower) {
			const nameMatch = climb.name.toLowerCase().includes(queryLower);
			const setterMatch = climb.setter_username.toLowerCase().includes(queryLower);
			if (!nameMatch && !setterMatch) continue;
		}

		const stats = statsByClimbUuid.get(climb.uuid) ?? [];

		// Angle filter: match climbs that have stats at the selected angle
		if (angle !== null) {
			const hasAngle =
				stats.some((s) => s.angle === angle) || (climb.angle !== null && climb.angle === angle);
			if (!hasAngle) continue;
		}

		// Pick the stats record relevant to the selected angle for filtering + display
		const activeStats = pickActiveStats(stats, angle);

		// Grade range filter (applied to difficulty from activeStats)
		if (hasGradeFilter) {
			if (!activeStats) continue;
			const d = activeStats.difficulty_average;
			if (d < diffMin || d > diffMax) continue;
		}

		// Quality filter
		if (minQuality > 0) {
			if (!activeStats || activeStats.quality_average < minQuality) continue;
		}

		// Benchmark filter
		if (onlyBenchmarks) {
			if (!activeStats || activeStats.benchmark_difficulty === null) continue;
		}

		// Campus / route type filters
		if (onlyCampus && !climb.is_campus) continue;
		if (onlyRoutes && !climb.is_route) continue;

		results.push({ climb, stats, activeStats });
	}

	// Default sort: quality desc, then difficulty asc
	results.sort((a, b) => {
		const qa = a.activeStats?.quality_average ?? 0;
		const qb = b.activeStats?.quality_average ?? 0;
		if (qb !== qa) return qb - qa;
		const da = a.activeStats?.difficulty_average ?? 0;
		const db = b.activeStats?.difficulty_average ?? 0;
		return da - db;
	});

	return results;
}

/**
 * Fetch a single climb by UUID.
 */
export async function getClimb(
	uuid: string,
	angle: number | null = null
): Promise<ClimbWithStats | null> {
	const climb = allClimbs.find((c) => c.uuid === uuid);
	if (!climb) return null;
	return joinClimb(climb, angle);
}

/**
 * Resolve a climb's frames string into holds with LED positions.
 * These are used directly by the BLE module to light up the board.
 */
export async function resolveHolds(climb: Climb): Promise<ResolvedHold[]> {
	const tokens = parseFrames(climb.frames);
	const resolved: ResolvedHold[] = [];
	for (const token of tokens) {
		const ledPosition = ledByPlacementId.get(token.placementId);
		if (ledPosition === undefined) continue; // hold not on this board config
		resolved.push({
			placementId: token.placementId,
			roleId: token.roleId,
			ledPosition
		});
	}
	return resolved;
}

/**
 * Returns all unique angles that have climb data.
 */
export async function getAvailableAngles(): Promise<number[]> {
	const angles = new Set<number>();
	for (const s of allStats) angles.add(s.angle);
	return [...angles].sort((a, b) => a - b);
}

// ── Real API upgrade path (not implemented yet) ──────────────────────────────
//
// When you're ready to use real data:
//
// 1. Add `src/lib/data/kilter-api.ts`:
//    - POST /sessions   → get token
//    - POST /sync       → fetch tables (form-encoded, see types.ts header)
//
// 2. Add `src/routes/api/sync/+server.ts`:
//    - Call kilter-api.ts, write results to local SQLite via Drizzle
//    - Return { ok: true, syncedAt: Date }
//
// 3. Replace the mock JSON imports above with queries against the local DB:
//    import { db } from '$lib/server/db';
//    const allClimbs = await db.select().from(schema.climbs);
//    etc.
//
// 4. The rest of the app (BLE, UI) is completely unaffected.
