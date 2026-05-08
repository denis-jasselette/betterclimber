/**
 * User climb log — stored in localStorage.
 *
 * Tracks per-climb-per-angle actions: tick (sent), attempt count, like, lastLitAt.
 * Each entry is keyed by `${uuid}@${angle}` (e.g. "FC1D...@45").
 *
 * Storage key is versioned (`kb_user_log_v2`). The old `kb_user_log` key (uuid-only
 * keys) is silently ignored — data loss is acceptable during closed beta.
 *
 * Upgrade path: when real Kilter API auth is wired up, replace the
 * localStorage reads/writes with calls to the `user_ascents` and
 * `user_climb_likes` tables from the /sync endpoint.
 */

export type LogEntry = {
	ticked: boolean
	/** Number of attempts logged (0 = none). */
	attemptCount: number
	liked: boolean
	/**
	 * ISO timestamp of the last time this climb was lit up on the board via BLE
	 * at this angle. Undefined / null means it has never been displayed.
	 */
	lastLitAt?: string | null
}

const STORAGE_KEY = 'kb_user_log_v2'

function logKey(uuid: string, angle: number): string {
	return `${uuid}@${angle}`
}

function load(): Record<string, LogEntry> {
	if (typeof localStorage === 'undefined') return {}
	try {
		return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Record<string, LogEntry>
	} catch {
		return {}
	}
}

function save(log: Record<string, LogEntry>) {
	if (typeof localStorage === 'undefined') return
	localStorage.setItem(STORAGE_KEY, JSON.stringify(log))
}

const EMPTY: LogEntry = { ticked: false, attemptCount: 0, liked: false }

function mutateEntry(uuid: string, angle: number, fn: (e: LogEntry) => LogEntry) {
	const log = load()
	const key = logKey(uuid, angle)
	log[key] = fn(log[key] ?? { ...EMPTY })
	save(log)
}

export function getEntry(uuid: string, angle: number | null): LogEntry {
	if (angle === null) return { ...EMPTY }
	return load()[logKey(uuid, angle)] ?? { ...EMPTY }
}

export function setTicked(uuid: string, angle: number | null, value: boolean) {
	if (angle === null) return
	mutateEntry(uuid, angle, (e) => ({ ...e, ticked: value }))
}

/** Increment the attempt counter by 1. */
export function incrementAttempts(uuid: string, angle: number | null) {
	if (angle === null) return
	mutateEntry(uuid, angle, (e) => ({ ...e, attemptCount: e.attemptCount + 1 }))
}

/** Reset the attempt counter to 0. */
export function resetAttempts(uuid: string, angle: number | null) {
	if (angle === null) return
	mutateEntry(uuid, angle, (e) => ({ ...e, attemptCount: 0 }))
}

export function setLiked(uuid: string, angle: number | null, value: boolean) {
	if (angle === null) return
	mutateEntry(uuid, angle, (e) => ({ ...e, liked: value }))
}

/** Record that this climb was just lit up on the board at this angle. */
export function recordLitUp(uuid: string, angle: number | null) {
	if (angle === null) return
	mutateEntry(uuid, angle, (e) => ({ ...e, lastLitAt: new Date().toISOString() }))
}

/**
 * Returns the set of UUIDs (without the @angle suffix) whose entry at the
 * given angle matches the predicate.
 */
export function getUuidsWhere(angle: number | null, pred: (e: LogEntry) => boolean): Set<string> {
	if (angle === null) return new Set()
	const log = load()
	const suffix = `@${angle}`
	return new Set(
		Object.entries(log)
			.filter(([key, e]) => key.endsWith(suffix) && pred(e))
			.map(([key]) => key.slice(0, -suffix.length))
	)
}
