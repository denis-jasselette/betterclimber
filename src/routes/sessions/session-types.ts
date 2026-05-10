/**
 * Shared types and helpers for session template pages.
 */

export type Exercise = {
	id: string
	block_id?: string
	position?: number
	name: string
	description: string | null
	type: string
	series_count: number
	rest_s: number
	// reps
	reps: number | null
	// timed
	duration_s: number | null
	// climb
	grade_ref: string | null
	climb_count: number | null
	duration_per_climb_s: number | null
	rest_between_climbs_s: number | null
}

export type Block = {
	id: string
	name: string
	description: string | null
	position: number
	exercises: Exercise[]
}

export type Template = {
	id: string
	name: string
	description: string | null
	blocks: Block[]
}

/** Format seconds as "Xm Ys" or just "Ys" */
export function formatDuration(s: number): string {
	if (s < 60) return `${s}s`
	const m = Math.floor(s / 60)
	const rem = s % 60
	return rem > 0 ? `${m}m ${rem}s` : `${m}m`
}
