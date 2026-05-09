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

/** Grade label with tick count. */
export interface GradeCount {
	grade: string
	count: number
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
 * Returns ticked climb counts grouped by V-grade (all grades, zero counts included).
 * Only counts entries where ticked=true and difficulty is stored.
 * When a range is provided, filters by tickedAt date.
 */
export function getGradeDistribution(range?: DateRange): GradeCount[] {
	const entries = getAllEntries()
	const gradeCounts = new Map<string, number>()

	for (const grade of ALL_GRADES) {
		gradeCounts.set(grade, 0)
	}

	for (const entry of Object.values(entries)) {
		if (!entry.ticked || entry.difficulty == null) continue
		if (range) {
			const tickedAt = entry.tickedAt ? new Date(entry.tickedAt) : null
			if (!tickedAt) continue
			if (range.from && tickedAt < range.from) continue
			if (range.to && tickedAt > range.to) continue
		}
		const grade = difficultyToGrade(entry.difficulty)
		gradeCounts.set(grade, (gradeCounts.get(grade) ?? 0) + 1)
	}

	return ALL_GRADES.map((grade) => ({ grade, count: gradeCounts.get(grade) ?? 0 }))
}

/** Total ticks, optionally filtered to a date range (by tickedAt). */
export function getTotalTicks(range?: DateRange): number {
	return Object.values(getAllEntries()).filter((e) => {
		if (!e.ticked) return false
		if (range) {
			const tickedAt = e.tickedAt ? new Date(e.tickedAt) : null
			if (!tickedAt) return false
			if (range.from && tickedAt < range.from) return false
			if (range.to && tickedAt > range.to) return false
		}
		return true
	}).length
}

/** Total unique climbs lit up, optionally filtered to a date range (by lastLitAt). */
export function getTotalClimbsLit(range?: DateRange): number {
	return Object.values(getAllEntries()).filter((e) => {
		if (!e.lastLitAt) return false
		if (range) {
			const litAt = new Date(e.lastLitAt)
			if (range.from && litAt < range.from) return false
			if (range.to && litAt > range.to) return false
		}
		return true
	}).length
}
