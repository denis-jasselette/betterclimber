/**
 * Custom climb service — user-created climbs stored in localStorage.
 *
 * Custom climbs share the same frames format as real Kilter climbs
 * and can be sent to the board via BLE just like any other climb.
 */

import { browser } from '$app/environment'
import { parseFrames } from './frames-parser'
import type { ClimbFilters, ClimbWithStats } from './types'

const STORAGE_KEY = 'kb_custom_climbs'

export interface CustomClimb {
	uuid: string
	name: string
	description: string
	frames: string
	angle: number | null
	/** Proposed difficulty (numeric, matches DIFFICULTY_GRADES). null = ungraded. */
	difficulty: number | null
	/** Whether hand-matching on start holds is allowed. */
	allowMatches: boolean
	/** Campus problem — no feet. */
	isCampus: boolean
	/** Draft — not yet published. */
	isDraft: boolean
	createdAt: string
}

// ── localStorage helpers ──────────────────────────────────────────────────────

function load(): CustomClimb[] {
	if (!browser) return []
	try {
		return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as CustomClimb[]
	} catch {
		return []
	}
}

function save(climbs: CustomClimb[]) {
	if (!browser) return
	localStorage.setItem(STORAGE_KEY, JSON.stringify(climbs))
}

// ── Public CRUD API ───────────────────────────────────────────────────────────

export function getCustomClimbs(): CustomClimb[] {
	return load()
}

export function getCustomClimb(uuid: string): CustomClimb | undefined {
	return load().find((c) => c.uuid === uuid)
}

export function saveCustomClimb(climb: CustomClimb): void {
	const climbs = load()
	const idx = climbs.findIndex((c) => c.uuid === climb.uuid)
	if (idx >= 0) {
		climbs[idx] = climb
	} else {
		climbs.unshift(climb) // newest first
	}
	save(climbs)
}

export function deleteCustomClimb(uuid: string): void {
	save(load().filter((c) => c.uuid !== uuid))
}

// ── Adapter: CustomClimb → ClimbWithStats ────────────────────────────────────

export function toClimbWithStats(c: CustomClimb): ClimbWithStats {
	return {
		climb: {
			uuid: c.uuid,
			layout_id: 1,
			setter_id: 0,
			setter_username: '@me',
			name: c.name,
			description: c.description,
			frames: c.frames,
			frames_count: parseFrames(c.frames).length,
			angle: c.angle,
			is_draft: c.isDraft,
			allow_matches: c.allowMatches,
			is_campus: c.isCampus,
			is_route: false
		},
		stats: [],
		// Synthesise minimal activeStats when angle + difficulty are both set,
		// so the grade badge on the detail page shows the proposed grade.
		activeStats:
			c.angle !== null && c.difficulty !== null
				? {
						climb_uuid: c.uuid,
						angle: c.angle,
						difficulty_average: c.difficulty,
						benchmark_difficulty: null,
						quality_average: 0,
						ascent_count: 0
					}
				: null
	}
}

// ── Filter custom climbs client-side ─────────────────────────────────────────

/**
 * Returns custom climbs that match the current filters as ClimbWithStats.
 * Custom climbs with angle=null match any board angle.
 * Only text/angle filters are applied — stat-based filters (grade, quality, etc.)
 * are skipped since custom climbs have no community stats.
 */
export function filterCustomClimbs(
	climbs: CustomClimb[],
	filters: Partial<ClimbFilters>,
	angle: number | null
): ClimbWithStats[] {
	const { query, nameQuery, descriptionQuery, authorQuery } = filters

	return climbs
		.filter((c) => {
			// Angle filter: custom climb with angle=null matches everything
			if (angle !== null && c.angle !== null && c.angle !== angle) return false

			// Text filters
			const q = query?.trim().toLowerCase()
			const nq = nameQuery?.trim().toLowerCase()
			const dq = descriptionQuery?.trim().toLowerCase()
			const aq = authorQuery?.trim().toLowerCase()

			if (q && !c.name.toLowerCase().includes(q) && !c.description.toLowerCase().includes(q))
				return false
			if (nq && !c.name.toLowerCase().includes(nq)) return false
			if (dq && !c.description.toLowerCase().includes(dq)) return false
			// authorQuery '@me' is a special case that always matches custom climbs.
			// Any other author query is checked against '@me'.
			if (aq && aq !== '@me' && !'@me'.includes(aq)) return false

			return true
		})
		.map(toClimbWithStats)
}
