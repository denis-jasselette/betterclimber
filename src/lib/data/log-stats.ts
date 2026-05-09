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

/** Grade label with ticked + attempted-only counts. */
export interface GradeCount {
	grade: string
	/** Climbs ticked at this grade. */
	ticked: number
	/** Climbs attempted but not yet ticked at this grade. */
	attemptedOnly: number
}

/** One ISO week (Mon–Sun) with aggregate activity. */
export interface WeekActivity {
	/** ISO week start date (Monday) as YYYY-MM-DD. */
	weekStart: string
	climbCount: number
}

export interface PersonalBests {
	/** Hardest grade sent on the first attempt (attempt_count = 0). Null if none. */
	highestFlash: string | null
	/** Hardest grade ever ticked. Null if none. */
	highestTick: string | null
	/** Total attempts ÷ distinct active days. Null if no data. */
	avgAttemptsPerDay: number | null
}

export interface DateRange {
	from: Date | null
	to: Date | null
}

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

function inRange(isoDate: string | null | undefined, range: DateRange | undefined): boolean {
	if (!range || (!range.from && !range.to)) return true
	if (!isoDate) return false
	const d = new Date(isoDate)
	if (range.from && d < range.from) return false
	if (range.to && d > range.to) return false
	return true
}

/**
 * Returns activity grouped by calendar day.
 * Without a range, shows the last 182 days (~6 months).
 * With a range, shows every day from range.from to range.to (or today).
 */
export function getActivityByDay(daysOrRange: number | DateRange = 182): DayActivity[] {
	const entries = getAllEntries()
	const today = new Date()
	today.setHours(23, 59, 59, 999)

	let from: Date
	let to: Date = today

	if (typeof daysOrRange === 'number') {
		from = new Date(today)
		from.setDate(from.getDate() - daysOrRange)
	} else {
		from =
			daysOrRange.from ??
			(() => {
				const d = new Date(today)
				d.setDate(d.getDate() - 182)
				return d
			})()
		if (daysOrRange.to) to = new Date(daysOrRange.to)
		to.setHours(23, 59, 59, 999)
	}

	const litByDay = new Map<string, Set<string>>()
	const tickedByDay = new Map<string, Set<string>>()

	for (const [key, entry] of Object.entries(entries)) {
		if (entry.lastLitAt) {
			const d = new Date(entry.lastLitAt)
			if (d >= from && d <= to) {
				const ds = toDateStr(entry.lastLitAt)
				if (!litByDay.has(ds)) litByDay.set(ds, new Set())
				litByDay.get(ds)?.add(key)
			}
		}
		if (entry.tickedAt) {
			const d = new Date(entry.tickedAt)
			if (d >= from && d <= to) {
				const ds = toDateStr(entry.tickedAt)
				if (!tickedByDay.has(ds)) tickedByDay.set(ds, new Set())
				tickedByDay.get(ds)?.add(key)
			}
		}
	}

	const result: DayActivity[] = []
	const cursor = new Date(from)
	cursor.setHours(0, 0, 0, 0)
	cursor.setDate(cursor.getDate() + 1)

	while (cursor <= to) {
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
export function getActivityByWeek(daysOrRange: number | DateRange = 182): WeekActivity[] {
	const daily = getActivityByDay(daysOrRange)
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
 * Returns ticked + attempted-only climb counts per V-grade.
 * Only includes grades with at least one entry.
 */
export function getGradeDistribution(range?: DateRange): GradeCount[] {
	const entries = getAllEntries()

	return ALL_GRADES.map((grade) => {
		let ticked = 0
		let attemptedOnly = 0
		for (const entry of Object.values(entries)) {
			if (entry.difficulty == null) continue
			if (difficultyToGrade(entry.difficulty) !== grade) continue
			if (entry.ticked && inRange(entry.tickedAt ?? null, range)) {
				ticked++
			} else if (
				!entry.ticked &&
				(entry.attemptCount ?? 0) > 0 &&
				inRange(entry.lastLitAt ?? null, range)
			) {
				attemptedOnly++
			}
		}
		return { grade, ticked, attemptedOnly }
	})
}

/** Total ticks across all entries, optionally filtered by date range (uses tickedAt). */
export function getTotalTicks(range?: DateRange): number {
	return Object.values(getAllEntries()).filter(
		(e) => e.ticked && inRange(e.tickedAt ?? null, range)
	).length
}

/** Total unique climbs lit up, optionally filtered by date range. */
export function getTotalClimbsLit(range?: DateRange): number {
	return Object.values(getAllEntries()).filter((e) => e.lastLitAt && inRange(e.lastLitAt, range))
		.length
}

/** Sum of all attempt counts, optionally filtered by range (uses lastLitAt as proxy). */
export function getTotalAttempts(range?: DateRange): number {
	return Object.values(getAllEntries()).reduce((sum, e) => {
		if (!inRange(e.lastLitAt ?? null, range)) return sum
		return sum + (e.attemptCount ?? 0)
	}, 0)
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
		if (!inRange(entry.tickedAt ?? null, range)) continue
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

	// Avg attempts per day: total attempts / distinct active days (using lastLitAt)
	const activeDays = new Set<string>()
	let totalAttemptCount = 0
	for (const entry of entries) {
		if ((entry.attemptCount ?? 0) > 0 && entry.lastLitAt && inRange(entry.lastLitAt, range)) {
			totalAttemptCount += entry.attemptCount ?? 0
			activeDays.add(entry.lastLitAt.slice(0, 10))
		}
	}
	const avgAttemptsPerDay =
		activeDays.size > 0 ? Math.round((totalAttemptCount / activeDays.size) * 10) / 10 : null

	return { highestFlash, highestTick, avgAttemptsPerDay }
}
