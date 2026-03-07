/**
 * User climb log — stored in localStorage.
 *
 * Tracks per-climb actions: tick (sent), attempt count, like.
 * Each entry is keyed by climb UUID.
 *
 * Upgrade path: when real Kilter API auth is wired up, replace the
 * localStorage reads/writes with calls to the `user_ascents` and
 * `user_climb_likes` tables from the /sync endpoint.
 */

export type LogEntry = {
	ticked: boolean;
	/** Number of attempts logged (0 = none). */
	attemptCount: number;
	liked: boolean;
	/**
	 * ISO timestamp of the last time this climb was lit up on the board via BLE.
	 * Undefined / null means it has never been displayed.
	 */
	lastLitAt?: string | null;
};

const STORAGE_KEY = 'kb_user_log';

function load(): Record<string, LogEntry> {
	if (typeof localStorage === 'undefined') return {};
	try {
		const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
		// Migrate old boolean `attempted` field to numeric `attemptCount`
		for (const [uuid, entry] of Object.entries(raw) as [string, Record<string, unknown>][]) {
			if (typeof entry.attempted === 'boolean') {
				raw[uuid].attemptCount = entry.attempted ? 1 : 0;
				delete raw[uuid].attempted;
			}
			if (typeof raw[uuid].attemptCount !== 'number') {
				raw[uuid].attemptCount = 0;
			}
		}
		return raw as Record<string, LogEntry>;
	} catch {
		return {};
	}
}

function save(log: Record<string, LogEntry>) {
	if (typeof localStorage === 'undefined') return;
	localStorage.setItem(STORAGE_KEY, JSON.stringify(log));
}

const EMPTY: LogEntry = { ticked: false, attemptCount: 0, liked: false };

export function getEntry(uuid: string): LogEntry {
	return load()[uuid] ?? { ...EMPTY };
}

export function setTicked(uuid: string, value: boolean) {
	const log = load();
	log[uuid] = { ...EMPTY, ...log[uuid], ticked: value };
	save(log);
}

/** Increment the attempt counter by 1. */
export function incrementAttempts(uuid: string) {
	const log = load();
	const entry = log[uuid] ?? { ...EMPTY };
	log[uuid] = { ...entry, attemptCount: entry.attemptCount + 1 };
	save(log);
}

/** Reset the attempt counter to 0. */
export function resetAttempts(uuid: string) {
	const log = load();
	const entry = log[uuid] ?? { ...EMPTY };
	log[uuid] = { ...entry, attemptCount: 0 };
	save(log);
}

export function setLiked(uuid: string, value: boolean) {
	const log = load();
	log[uuid] = { ...EMPTY, ...log[uuid], liked: value };
	save(log);
}

/** Record that this climb was just lit up on the board. Stores current ISO timestamp. */
export function recordLitUp(uuid: string) {
	const log = load();
	const entry = log[uuid] ?? { ...EMPTY };
	log[uuid] = { ...entry, lastLitAt: new Date().toISOString() };
	save(log);
}

/** Returns the set of UUIDs matching the given predicate. */
export function getUuidsWhere(pred: (e: LogEntry) => boolean): Set<string> {
	const log = load();
	return new Set(Object.entries(log).filter(([, e]) => pred(e)).map(([uuid]) => uuid));
}
