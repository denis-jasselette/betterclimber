/**
 * Data Access Layer — Repository
 *
 * This is the ONLY client-side file that knows where climb data comes from.
 * Backed by the /api/climbs SvelteKit endpoint (Neon PostgreSQL).
 *
 * Public API (never changes regardless of backing store):
 *   searchClimbs(filters, angle)  → Promise<ClimbWithStats[]>
 *   getClimb(uuid, angle)         → Promise<ClimbWithStats | null>
 *   resolveHolds(climb)           → Promise<ResolvedHold[]>
 *
 * Note: resolveHolds is backed by static JSON (placements/holes/leds never change).
 * Note: log-service filters (excludeTicked, onlyAttempted, etc.) are applied
 *       client-side on top of the API results, since they use localStorage.
 */

import { parseFrames } from './frames-parser'
import { getUuidsWhere } from './log-service'
import ledsJson from './mock/leds.json'
import placementsJson from './mock/placements.json'
import type {
	Climb,
	ClimbFilters,
	ClimbStats,
	ClimbWithStats,
	Led,
	Placement,
	ResolvedHold
} from './types'
import { ALL_ANGLES, DIFFICULTY_GRADES } from './types'

// ── Static board geometry (used only for BLE hold resolution) ────────────────

const allPlacements = placementsJson as Placement[]
const allLeds = ledsJson as Led[]

/** placement_id → Led.position */
const ledByPlacementId = new Map<number, number>()
{
	const holeToLedPos = new Map<number, number>(allLeds.map((l) => [l.hole_id, l.position]))
	for (const p of allPlacements) {
		const pos = holeToLedPos.get(p.hole_id)
		if (pos !== undefined) ledByPlacementId.set(p.id, pos)
	}
}

// ── Grade range helpers ───────────────────────────────────────────────────────

function gradeToMinDifficulty(grade: string): number {
	const matches = DIFFICULTY_GRADES.filter((g) => g.boulder_name === grade)
	if (matches.length === 0) return 0
	return Math.min(...matches.map((g) => g.difficulty))
}

function gradeToMaxDifficulty(grade: string): number {
	const matches = DIFFICULTY_GRADES.filter((g) => g.boulder_name === grade)
	if (matches.length === 0) return Infinity
	return Math.max(...matches.map((g) => g.difficulty))
}

// ── API helpers ───────────────────────────────────────────────────────────────

function buildSearchParams(filters: Partial<ClimbFilters>, angle: number | null): URLSearchParams {
	const p = new URLSearchParams()
	if (angle !== null) p.set('angle', String(angle))

	const { gradeMin, gradeMax, minQuality, query, onlyBenchmarks, onlyCampus, onlyRoutes } = filters

	if (gradeMin != null) p.set('gradeMin', String(gradeToMinDifficulty(gradeMin)))
	if (gradeMax != null) p.set('gradeMax', String(gradeToMaxDifficulty(gradeMax)))
	if (minQuality && minQuality > 0) p.set('minQuality', String(minQuality))
	if (query?.trim()) p.set('query', query.trim())
	if (onlyBenchmarks) p.set('onlyBenchmarks', '1')
	if (onlyCampus) p.set('onlyCampus', '1')
	if (onlyRoutes) p.set('onlyRoutes', '1')

	p.set('limit', '200')

	return p
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Search and filter climbs via the /api/climbs endpoint.
 * Log-service filters (excludeTicked, onlyAttempted, etc.) are applied locally.
 */
export async function searchClimbs(
	filters: Partial<ClimbFilters> = {},
	angle: number | null = null
): Promise<ClimbWithStats[]> {
	const {
		excludeTicked = false,
		onlyAttempted = false,
		onlyLiked = false,
		onlyRecentlyLit = false
	} = filters

	const params = buildSearchParams(filters, angle)
	const res = await fetch(`/api/climbs?${params}`)
	if (!res.ok) return []

	const { climbs: rawClimbs } = (await res.json()) as { climbs: ClimbWithStats[] }

	// Apply log-service filters client-side (localStorage — server can't see these)
	const tickedUuids = excludeTicked ? getUuidsWhere((e) => e.ticked) : new Set<string>()
	const attemptedUuids = onlyAttempted
		? getUuidsWhere((e) => e.attemptCount > 0)
		: new Set<string>()
	const likedUuids = onlyLiked ? getUuidsWhere((e) => e.liked) : new Set<string>()
	const litUuids = onlyRecentlyLit ? getUuidsWhere((e) => !!e.lastLitAt) : new Set<string>()

	return rawClimbs.filter((item) => {
		const uuid = item.climb.uuid
		if (excludeTicked && tickedUuids.has(uuid)) return false
		if (onlyAttempted && !attemptedUuids.has(uuid)) return false
		if (onlyLiked && !likedUuids.has(uuid)) return false
		if (onlyRecentlyLit && !litUuids.has(uuid)) return false
		return true
	})
}

/**
 * Fetch a single climb by UUID from the /api/climbs/:uuid endpoint.
 */
export async function getClimb(
	uuid: string,
	angle: number | null = null
): Promise<ClimbWithStats | null> {
	const params = angle !== null ? `?angle=${angle}` : ''
	const res = await fetch(`/api/climbs/${uuid}${params}`)
	if (res.status === 404) return null
	if (!res.ok) return null
	return (await res.json()) as ClimbWithStats
}

/**
 * Resolve a climb's frames string into holds with LED positions.
 * Uses static local JSON — board geometry never changes.
 */
export async function resolveHolds(climb: Climb): Promise<ResolvedHold[]> {
	const tokens = parseFrames(climb.frames)
	const resolved: ResolvedHold[] = []
	for (const token of tokens) {
		const ledPosition = ledByPlacementId.get(token.placementId)
		if (ledPosition === undefined) continue
		resolved.push({
			placementId: token.placementId,
			roleId: token.roleId,
			ledPosition
		})
	}
	return resolved
}

/**
 * Returns available angles.
 * Since we don't have a dedicate endpoint for this yet, use the hardcoded list from types.
 */
export async function getAvailableAngles(): Promise<number[]> {
	return [...ALL_ANGLES]
}

// ── Compatibility re-exports ──────────────────────────────────────────────────
// These let other modules import shared types from repository without changing imports.
export type { Climb, ClimbFilters, ClimbStats, ClimbWithStats, ResolvedHold }
