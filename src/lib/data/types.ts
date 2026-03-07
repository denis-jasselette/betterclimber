/**
 * TypeScript types mirroring the Kilter Board SQLite database schema.
 * Field names match the real DB columns to make future real-API integration trivial.
 */

// ─── Core board geometry ────────────────────────────────────────────────────

/** A physical hole in the board surface. */
export interface Hole {
	id: number;
	/** Pixel x-coordinate on the board image (origin top-left). */
	x: number;
	/** Pixel y-coordinate on the board image (origin top-left). */
	y: number;
}

/** Maps a hole to an LED strip position address used for BLE commands. */
export interface Led {
	id: number;
	hole_id: number;
	/** The BLE address sent in the Aurora protocol packet. */
	position: number;
}

/**
 * A placement is a hold installed at a specific hole for a given layout/set combo.
 * The `frames` string in a climb references placement IDs.
 */
export interface Placement {
	id: number;
	hole_id: number;
	set_id: number;
	layout_id: number;
}

// ─── Hold roles (colors) ────────────────────────────────────────────────────

/**
 * Role IDs from the real Kilter DB (placement_roles table).
 * These map directly to the `r{id}` tokens in a climb's frames string.
 */
export const ROLE = {
	START: 12,
	HAND: 13,
	FINISH: 14,
	FOOT: 15
} as const;

export type RoleId = (typeof ROLE)[keyof typeof ROLE];

/** LED colors (8-bit RGB) for each hold role, matching the real app. */
export const ROLE_COLORS: Record<RoleId, { r: number; g: number; b: number; hex: string }> = {
	[ROLE.START]: { r: 0x00, g: 0xff, b: 0x00, hex: '#00ff00' }, // green
	[ROLE.HAND]: { r: 0x00, g: 0xff, b: 0xff, hex: '#00ffff' }, // cyan
	[ROLE.FINISH]: { r: 0xff, g: 0x00, b: 0xff, hex: '#ff00ff' }, // magenta
	[ROLE.FOOT]: { r: 0xff, g: 0xaa, b: 0x00, hex: '#ffaa00' } // amber
};

/** Human-readable label for each role. */
export const ROLE_LABELS: Record<RoleId, string> = {
	[ROLE.START]: 'Start',
	[ROLE.HAND]: 'Hand',
	[ROLE.FINISH]: 'Finish',
	[ROLE.FOOT]: 'Foot'
};

// ─── Climbs ─────────────────────────────────────────────────────────────────

/**
 * A parsed hold token from a climb's frames string.
 * e.g. "p1083r15" → { placementId: 1083, roleId: 15 }
 */
export interface HoldToken {
	placementId: number;
	roleId: RoleId;
}

/**
 * Core climb record (mirrors the `climbs` table).
 */
export interface Climb {
	uuid: string;
	layout_id: number;
	setter_id: number;
	setter_username: string;
	name: string;
	description: string;
	/** Encoded hold string, e.g. "p1083r15p1117r15p1164r12..." */
	frames: string;
	frames_count: number;
	/** If set, the climb is designed for a specific angle; null = any angle. */
	angle: number | null;
	is_draft: boolean;
	/** Whether hand matching on the start holds is allowed. */
	allow_matches: boolean;
	/** Campus problem — no feet used. */
	is_campus: boolean;
	/** Set as a route (top-out style) rather than a boulder. */
	is_route: boolean;
}

/**
 * Per-angle statistics for a climb (mirrors `climb_stats` table).
 * There may be multiple records per climb (one per voted angle).
 */
export interface ClimbStats {
	climb_uuid: string;
	/** Board angle in degrees (e.g. 20, 25, 30, 35, 40, 45). */
	angle: number;
	/** Average community-voted difficulty (numeric). Maps to V-grade via DIFFICULTY_GRADES. */
	difficulty_average: number;
	/** Official benchmark difficulty (numeric), or null if not benchmarked. */
	benchmark_difficulty: number | null;
	/** Stars 1–3, community average. */
	quality_average: number;
	/** Total number of ascents logged at this angle. */
	ascent_count: number;
}

// ─── Grades ─────────────────────────────────────────────────────────────────

/**
 * Maps a numeric difficulty value to a V-grade label.
 * Mirrors the `difficulty_grades` table.
 */
export interface DifficultyGrade {
	difficulty: number;
	/** e.g. "V0", "V5", "V10" */
	boulder_name: string;
}

/** The canonical grade table for Kilter Board difficulty values. */
export const DIFFICULTY_GRADES: DifficultyGrade[] = [
	{ difficulty: 1, boulder_name: 'V0' },
	{ difficulty: 2, boulder_name: 'V0' },
	{ difficulty: 3, boulder_name: 'V0' },
	{ difficulty: 4, boulder_name: 'V0' },
	{ difficulty: 5, boulder_name: 'V0' },
	{ difficulty: 6, boulder_name: 'V0' },
	{ difficulty: 7, boulder_name: 'V0' },
	{ difficulty: 8, boulder_name: 'V0' },
	{ difficulty: 9, boulder_name: 'V0' },
	{ difficulty: 10, boulder_name: 'V0' },
	{ difficulty: 11, boulder_name: 'V0' },
	{ difficulty: 12, boulder_name: 'V0' },
	{ difficulty: 13, boulder_name: 'V0' },
	{ difficulty: 14, boulder_name: 'V0' },
	{ difficulty: 15, boulder_name: 'V0' },
	{ difficulty: 16, boulder_name: 'V1' },
	{ difficulty: 17, boulder_name: 'V2' },
	{ difficulty: 18, boulder_name: 'V3' },
	{ difficulty: 19, boulder_name: 'V4' },
	{ difficulty: 20, boulder_name: 'V5' },
	{ difficulty: 21, boulder_name: 'V6' },
	{ difficulty: 22, boulder_name: 'V7' },
	{ difficulty: 23, boulder_name: 'V8' },
	{ difficulty: 24, boulder_name: 'V9' },
	{ difficulty: 25, boulder_name: 'V10' },
	{ difficulty: 26, boulder_name: 'V11' },
	{ difficulty: 27, boulder_name: 'V12' },
	{ difficulty: 28, boulder_name: 'V13' },
	{ difficulty: 29, boulder_name: 'V14' },
	{ difficulty: 30, boulder_name: 'V15' },
	{ difficulty: 31, boulder_name: 'V16' },
	{ difficulty: 32, boulder_name: 'V17' }
];

/** Lookup: numeric difficulty → V-grade string */
export function difficultyToGrade(difficulty: number): string {
	const exact = DIFFICULTY_GRADES.find((g) => g.difficulty === Math.round(difficulty));
	if (exact) return exact.boulder_name;
	// Fallback: clamp to nearest
	const sorted = [...DIFFICULTY_GRADES].sort(
		(a, b) => Math.abs(a.difficulty - difficulty) - Math.abs(b.difficulty - difficulty)
	);
	return sorted[0]?.boulder_name ?? 'V?';
}

/** Lookup: V-grade string → numeric difficulty (midpoint if multiple) */
export function gradeToDifficulty(grade: string): number {
	const matches = DIFFICULTY_GRADES.filter((g) => g.boulder_name === grade);
	if (matches.length === 0) return 0;
	return matches[Math.floor(matches.length / 2)].difficulty;
}

/** All distinct V-grade labels in order. */
export const ALL_GRADES: string[] = [
	...new Set(DIFFICULTY_GRADES.map((g) => g.boulder_name))
];

/** All supported board angles for the Kilter Board. */
export const ALL_ANGLES = [20, 25, 30, 35, 40, 45, 50, 55, 60] as const;
export type Angle = (typeof ALL_ANGLES)[number];

// ─── Search / filter types ───────────────────────────────────────────────────

export interface ClimbFilters {
	/**
	 * Grade range filter. Both are V-grade strings (e.g. "V3", "V7").
	 * null means no bound on that side (open range).
	 * If both are null, no grade filtering is applied.
	 */
	gradeMin: string | null;
	gradeMax: string | null;
	/** Minimum quality stars (1–3). 0 = no filter. */
	minQuality: number;
	/** Free-text search matched against name and setter_username. */
	query: string;
	/** Hide climbs the user has already ticked (sent). */
	excludeTicked: boolean;
	/** Show only climbs the user has logged an attempt on. */
	onlyAttempted: boolean;
	/** Show only climbs the user has liked. */
	onlyLiked: boolean;
	/** Show only benchmark climbs (those with a benchmark_difficulty set at the active angle). */
	onlyBenchmarks: boolean;
	/** Show only campus problems (no feet). */
	onlyCampus: boolean;
	/** Show only route-style climbs (top-out). */
	onlyRoutes: boolean;
	/** Show only climbs that have been lit up on the board at least once. */
	onlyRecentlyLit: boolean;
}

/** A climb enriched with its stats for display, joined across tables. */
export interface ClimbWithStats {
	climb: Climb;
	/** Stats for each angle that has community data. */
	stats: ClimbStats[];
	/**
	 * Stats for the currently selected angle, or the best overall record if
	 * no angle is selected. Used for quality/ascent display on the card.
	 */
	activeStats: ClimbStats | null;
}

// ─── Parsed hold ─────────────────────────────────────────────────────────────

/** A hold ready for BLE transmission or display, with position resolved. */
export interface ResolvedHold {
	placementId: number;
	roleId: RoleId;
	/** LED position address for BLE packet encoding. */
	ledPosition: number;
}

// ─── French grade mapping ────────────────────────────────────────────────────

/**
 * Maps each V-grade to its closest French/Fontainebleau equivalent.
 * Used when the user selects the French grading system in Settings.
 *
 * Conversion reference: widely-used community consensus mapping.
 */
export const V_TO_FRENCH: Record<string, string> = {
	V0:  '4',
	V1:  '5',
	V2:  '5+',
	V3:  '6A',
	V4:  '6B+',
	V5:  '6C',
	V6:  '7A',
	V7:  '7A+',
	V8:  '7B+',
	V9:  '7C',
	V10: '7C+',
	V11: '8A',
	V12: '8A+',
	V13: '8B',
	V14: '8B+',
	V15: '8C',
	V16: '8C+',
	V17: '9A',
};

/**
 * Format a V-grade string according to the user's grading system preference.
 * @param vGrade  e.g. "V5"
 * @param system  'v-scale' | 'french'
 */
export function formatGrade(vGrade: string, system: 'v-scale' | 'french'): string {
	if (system === 'v-scale') return vGrade;
	return V_TO_FRENCH[vGrade] ?? vGrade;
}
