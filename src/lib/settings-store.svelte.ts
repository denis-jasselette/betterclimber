import { browser } from '$app/environment';

export type GradingSystem = 'v-scale' | 'french';
export type ThemePreference = 'dark' | 'light' | 'system';

export interface AppSettings {
	gradingSystem: GradingSystem;
	theme: ThemePreference;
}

const STORAGE_KEY = 'kilter-settings';
// Cookie is read server-side so SSR always has the correct values.
// Max-age: 1 year; SameSite=Lax is fine (no cross-site posting needed).
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

const DEFAULTS: AppSettings = {
	gradingSystem: 'v-scale',
	theme: 'system'
};

function loadFromLocalStorage(): AppSettings {
	if (!browser) return { ...DEFAULTS };
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return { ...DEFAULTS };
		return { ...DEFAULTS, ...JSON.parse(raw) };
	} catch {
		return { ...DEFAULTS };
	}
}

function persist(s: AppSettings) {
	if (!browser) return;
	const json = JSON.stringify(s);
	// localStorage — for offline / PWA use
	localStorage.setItem(STORAGE_KEY, json);
	// Cookie — so the next SSR request (hard refresh, first visit on new tab)
	// can read the value before JavaScript runs.
	document.cookie = `kilter-settings=${encodeURIComponent(json)}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`;
}

// ── Reactive singleton ────────────────────────────────────────────────────────
// `init()` is called once from +layout.svelte with the server-supplied values
// so the store starts in the correct state on SSR and hard refresh.

function createSettings() {
	// Start from localStorage (or defaults on server). The layout will call
	// `init()` synchronously with the server value before any component renders.
	let data = $state<AppSettings>(loadFromLocalStorage());

	return {
		/**
		 * Called once by +layout.svelte with the values read from the cookie on
		 * the server. This overwrites the localStorage snapshot so that SSR HTML
		 * and the initial client render are always in agreement.
		 */
		init(serverSettings: AppSettings) {
			data.gradingSystem = serverSettings.gradingSystem;
			data.theme = serverSettings.theme;
		},

		get gradingSystem() { return data.gradingSystem; },
		set gradingSystem(v: GradingSystem) { data.gradingSystem = v; persist(data); },

		get theme() { return data.theme; },
		set theme(v: ThemePreference) { data.theme = v; persist(data); },
	};
}

export const settings = createSettings();
