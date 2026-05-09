/**
 * Stats computed from the user's local log for the training dashboard.
 *
 * All functions read from localStorage via getAllEntries() — safe to call
 * in onMount / browser-only contexts.
 */

import { getAllEntries } from './log-service'
import { ALL_GRADES, difficultyToGrade } from './types'

/** One calendar day with activity counts. */
export interface DayActivity {
	/** YYYY-MM-DD */
	date: string
	/** Number of unique climbs lit up (or ticked) on this day. */
	climbCount: number
	/** Number of unique climbs ticked on this day. */
	tickCount: number
}

/** Grade label with ticked + attempted-only split counts. */
export interface GradeCount {
	grade: string
	/** Climbs ticked at this grade. */
	ticked: number
	/** Climbs attempted but not yet ticked at this grade. */
	attemptedOnly: number
}

export interface PersonalBests {
	/** Hardest grade ticked. Null if none. */
	highestTick: string | null
	/** Hardest grade sent on the first attempt (attemptCount = 0). Null if none. */
	highestFlash: string | null
	/** Total attempts ÷ distinct active days. Null if no data. */
	avgAttemptsPerDay: number | null
}

/** One ISO week (Mon–Sun) with aggregate activity. */
export interface WeekActivity {
	/** ISO week start date (Monday) as YYYY-MM-DD. */
	weekStart: string
	climbCount: number
}

/** Optional date range filter. Undefined bounds are treated as open-ended. */
export interface DateRange {
	from?: Date
	to?: Date
}

/** Default display window in days when no date range is given. */
const DEFAULT_DAYS = 182

function toDateStr(iso: string): string {
	return iso.slice(0, 10)
}

function isoToMonday(date: Date): Date {
	const d = new Date(date)
	const day = d.getDay()
	const diff = day === 0 ? -6 : 1 - day
	d.setDate(d.getDate() + diff)
	d.setHours(0, 0, 0, 0)
	return d
}

/** Returns false if isoDate is outside the given range (or missing when range is set). */
function inRange(isoDate: string | null | undefined, range: DateRange): boolean {
	const d = isoDate ? new Date(isoDate) : null
	if (!d) return false
	if (range.from && d < range.from) return false
	if (range.to && d > range.to) return false
	return true
}

function resolveRange(range?: DateRange): { from: Date; to: Date } {
	const to =
		range?.to ??
		(() => {
			const d = new Date()
			d.setHours(23, 59, 59, 999)
			return d
		})()
	const from =
		range?.from ??
		(() => {
			const d = new Date(to)
			d.setDate(d.getDate() - DEFAULT_DAYS)
			return d
		})()
	return { from, to }
}

/**
 * Returns activity grouped by calendar day for the given date range.
 * Defaults to the last 182 days (~6 months) when no range is provided.
 */
export function getActivityByDay(range?: DateRange): DayActivity[] {
	const entries = getAllEntries()
	const { from: cutoff, to: today } = resolveRange(range)

	// Map from date string → set of unique "uuid@angle" keys
	const litByDay = new Map<string, Set<string>>()
	const tickedByDay = new Map<string, Set<string>>()

	for (const [key, entry] of Object.entries(entries)) {
		if (entry.lastLitAt) {
			const d = new Date(entry.lastLitAt)
			if (d >= cutoff && d <= today) {
				const ds = toDateStr(entry.lastLitAt)
				if (!litByDay.has(ds)) litByDay.set(ds, new Set())
				litByDay.get(ds)?.add(key)
			}
		}
		if (entry.tickedAt) {
			const d = new Date(entry.tickedAt)
			if (d >= cutoff && d <= today) {
				const ds = toDateStr(entry.tickedAt)
				if (!tickedByDay.has(ds)) tickedByDay.set(ds, new Set())
				tickedByDay.get(ds)?.add(key)
			}
		}
	}

	// Build a DayActivity for every day in the window
	const result: DayActivity[] = []
	const cursor = new Date(cutoff)
	cursor.setHours(0, 0, 0, 0)
	cursor.setDate(cursor.getDate() + 1)

	while (cursor <= today) {
		const ds = cursor.toISOString().slice(0, 10)
		result.push({
			date: ds,
			climbCount: litByDay.get(ds)?.size ?? 0,
			tickCount: tickedByDay.get(ds)?.size ?? 0
		})
		cursor.setDate(cursor.getDate() + 1)
	}

	return result
}

/**
 * Aggregates daily activity into ISO weeks (Monday start).
 */
export function getActivityByWeek(range?: DateRange): WeekActivity[] {
	const daily = getActivityByDay(range)
	const weekMap = new Map<string, number>()

	for (const day of daily) {
		const monday = isoToMonday(new Date(day.date))
		const weekKey = monday.toISOString().slice(0, 10)
		weekMap.set(weekKey, (weekMap.get(weekKey) ?? 0) + day.climbCount)
	}

	return [...weekMap.entries()]
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([weekStart, climbCount]) => ({ weekStart, climbCount }))
}

/**
 * Returns ticked + attempted-only climb counts per V-grade (all grades, zero counts included).
 * Only counts entries where difficulty is stored.
 * Ticked rows filtered by tickedAt; attempted-only rows filtered by lastLitAt.
 */
export function getGradeDistribution(range?: DateRange): GradeCount[] {
	const entries = getAllEntries()
	const tickedCounts = new Map<string, number>()
	const attemptedCounts = new Map<string, number>()

	for (const entry of Object.values(entries)) {
		if (entry.difficulty == null) continue
		const grade = difficultyToGrade(entry.difficulty)
		if (entry.ticked) {
			if (range && !inRange(entry.tickedAt, range)) continue
			tickedCounts.set(grade, (tickedCounts.get(grade) ?? 0) + 1)
		} else if ((entry.attemptCount ?? 0) > 0) {
			if (range && !inRange(entry.lastLitAt, range)) continue
			attemptedCounts.set(grade, (attemptedCounts.get(grade) ?? 0) + 1)
		}
	}

	return ALL_GRADES.map((grade) => ({
		grade,
		ticked: tickedCounts.get(grade) ?? 0,
		attemptedOnly: attemptedCounts.get(grade) ?? 0
	}))
}

/** Compute personal bests from the log, optionally filtered by date range. */
export function getPersonalBests(range?: DateRange): PersonalBests {
	const entries = Object.values(getAllEntries())

	let highestTickRank = -1
	let highestFlashRank = -1
	let highestTick: string | null = null
	let highestFlash: string | null = null

	for (const entry of entries) {
		if (!entry.ticked || entry.difficulty == null) continue
		if (range && !inRange(entry.tickedAt, range)) continue
		const grade = difficultyToGrade(entry.difficulty)
		const rank = ALL_GRADES.indexOf(grade)
		if (rank > highestTickRank) {
			highestTickRank = rank
			highestTick = grade
		}
		if ((entry.attemptCount ?? 0) === 0 && rank > highestFlashRank) {
			highestFlashRank = rank
			highestFlash = grade
		}
	}

	// Avg attempts per day: total attempts / distinct active days (proxy: lastLitAt date)
	const activeDays = new Set<string>()
	let totalAttempts = 0
	for (const entry of entries) {
		if ((entry.attemptCount ?? 0) > 0 && entry.lastLitAt) {
			if (range && !inRange(entry.lastLitAt, range)) continue
			totalAttempts += entry.attemptCount ?? 0
			activeDays.add(entry.lastLitAt.slice(0, 10))
		}
	}
	const avgAttemptsPerDay =
		activeDays.size > 0 ? Math.round((totalAttempts / activeDays.size) * 10) / 10 : null

	return { highestTick, highestFlash, avgAttemptsPerDay }
}

/** Total ticks, optionally filtered to a date range (by tickedAt). */
export function getTotalTicks(range?: DateRange): number {
	return Object.values(getAllEntries()).filter(
		(e) => e.ticked && (!range || inRange(e.tickedAt, range))
	).length
}

/** Total unique climbs lit up, optionally filtered to a date range (by lastLitAt). */
export function getTotalClimbsLit(range?: DateRange): number {
	return Object.values(getAllEntries()).filter(
		(e) => e.lastLitAt && (!range || inRange(e.lastLitAt, range))
	).length
}
