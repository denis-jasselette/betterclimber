/**
 * User climb log — stored in localStorage with optional DB sync.
 *
 * Tracks per-climb-per-angle actions: tick (sent), attempt count, like, lastLitAt.
 * Each entry is keyed by `${uuid}@${angle}` (e.g. "FC1D...@45").
 *
 * Storage key is versioned (`kb_user_log_v2`). The old `kb_user_log` key (uuid-only
 * keys) is silently ignored — data loss is acceptable during closed beta.
 *
 * DB sync (browser only):
 *  - On every write, fires-and-forgets a POST to /api/log.
 *  - On page load at a given angle, fetches GET /api/log?angle= and merges
 *    into the in-memory store. localStorage takes precedence so offline works.
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
	/** ISO timestamp when this climb was first ticked at this angle. */
	tickedAt?: string | null
	/** Numeric difficulty (community average) stored at tick time for stats. */
	difficulty?: number | null
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

/** Fire-and-forget POST to /api/log (browser only). */
function syncToDb(uuid: string, angle: number, patch: Partial<LogEntry>) {
	if (typeof fetch === 'undefined') return
	fetch('/api/log', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ climbUuid: uuid, angle, patch })
	}).catch(() => {
		// Ignore network errors — localStorage is the source of truth
	})
}

function mutateEntry(uuid: string, angle: number, fn: (e: LogEntry) => LogEntry) {
	const log = load()
	const key = logKey(uuid, angle)
	const updated = fn(log[key] ?? { ...EMPTY })
	log[key] = updated
	save(log)
	// Compute patch = delta between old and new
	const patch: Partial<LogEntry> = {}
	if (updated.ticked !== (log[key]?.ticked ?? false)) patch.ticked = updated.ticked
	if (updated.attemptCount !== undefined) patch.attemptCount = updated.attemptCount
	if (updated.liked !== undefined) patch.liked = updated.liked
	if (updated.lastLitAt !== undefined) patch.lastLitAt = updated.lastLitAt
	// Always sync the full updated entry so the server has correct state
	syncToDb(uuid, angle, updated)
}

export function getEntry(uuid: string, angle: number | null): LogEntry {
	if (angle === null) return { ...EMPTY }
	return load()[logKey(uuid, angle)] ?? { ...EMPTY }
}

export function setTicked(
	uuid: string,
	angle: number | null,
	value: boolean,
	difficulty?: number | null
) {
	if (angle === null) return
	mutateEntry(uuid, angle, (e) => ({
		...e,
		ticked: value,
		...(value && e.tickedAt == null ? { tickedAt: new Date().toISOString() } : {}),
		...(value && difficulty != null ? { difficulty } : {})
	}))
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

/** Returns all log entries with their parsed uuid and angle. */
export function getAllEntries(): Array<{ uuid: string; angle: number; entry: LogEntry }> {
	const log = load()
	return Object.entries(log).map(([key, entry]) => {
		const atIdx = key.lastIndexOf('@')
		return { uuid: key.slice(0, atIdx), angle: Number(key.slice(atIdx + 1)), entry }
	})
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

/**
 * Fetch the DB log for a given angle and merge into localStorage.
 * localStorage takes precedence (offline-first). Call once per angle on page load.
 */
export async function mergeDbLog(angle: number): Promise<void> {
	if (typeof fetch === 'undefined' || typeof localStorage === 'undefined') return
	try {
		const res = await fetch(`/api/log?angle=${angle}`)
		if (!res.ok) return
		const remote = (await res.json()) as Record<string, LogEntry>
		const local = load()
		// Merge: local wins for any key that already exists
		const merged = { ...remote, ...local }
		save(merged)
	} catch {
		// Ignore errors — localStorage is the source of truth
	}
}
