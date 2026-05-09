import { browser } from '$app/environment'
import { type Angle, isAngle } from '$lib/data/types'

export type GradingSystem = 'v-scale' | 'french'
export type ThemePreference = 'dark' | 'light' | 'system'

interface AppSettings {
	gradingSystem: GradingSystem
	theme: ThemePreference
	/** V-grade string the user sends reliably first go (e.g. 'V6'), or null if unset. */
	flashGrade: string | null
	/** V-grade string of the user's current project / limit (e.g. 'V9'), or null if unset. */
	projectGrade: string | null
	defaultAngle: Angle | null
}

const STORAGE_KEY = 'kilter-settings'
// Cookie is read server-side so SSR always has the correct values.
// Max-age: 1 year; SameSite=Lax is fine (no cross-site posting needed).
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365

const DEFAULTS: AppSettings = {
	gradingSystem: 'v-scale',
	theme: 'system',
	flashGrade: null,
	projectGrade: null,
	defaultAngle: null
}

function loadFromLocalStorage(): AppSettings {
	if (!browser) return { ...DEFAULTS }
	try {
		const raw = localStorage.getItem(STORAGE_KEY)
		if (!raw) return { ...DEFAULTS }
		const parsed = JSON.parse(raw)
		const defaultAngle =
			parsed.defaultAngle != null && isAngle(parsed.defaultAngle) ? parsed.defaultAngle : null
		return { ...DEFAULTS, ...parsed, defaultAngle }
	} catch {
		return { ...DEFAULTS }
	}
}

function persist(s: AppSettings) {
	if (!browser) return
	const json = JSON.stringify(s)
	// localStorage — for offline / PWA use
	localStorage.setItem(STORAGE_KEY, json)
	// Cookie — so the next SSR request (hard refresh, first visit on new tab)
	// can read the value before JavaScript runs.
	// biome-ignore lint/suspicious/noDocumentCookie: intentional SSR cookie sync
	document.cookie = `kilter-settings=${encodeURIComponent(json)}; path=/; max-age=${COOKIE_MAX_AGE}; SameSite=Lax`
}

// ── Reactive singleton ────────────────────────────────────────────────────────
// `init()` is called once from +layout.svelte with the server-supplied values
// so the store starts in the correct state on SSR and hard refresh.

function createSettings() {
	// Start from localStorage (or defaults on server). The layout will call
	// `init()` synchronously with the server value before any component renders.
	const data = $state<AppSettings>(loadFromLocalStorage())

	return {
		/**
		 * Called once by +layout.svelte with the values read from the cookie on
		 * the server. This overwrites the localStorage snapshot so that SSR HTML
		 * and the initial client render are always in agreement.
		 */
		init(serverSettings: AppSettings) {
			data.gradingSystem = serverSettings.gradingSystem
			data.theme = serverSettings.theme
			data.flashGrade = serverSettings.flashGrade
			data.projectGrade = serverSettings.projectGrade
			data.defaultAngle = serverSettings.defaultAngle
		},

		get gradingSystem() {
			return data.gradingSystem
		},
		set gradingSystem(v: GradingSystem) {
			data.gradingSystem = v
			persist(data)
		},

		get theme() {
			return data.theme
		},
		set theme(v: ThemePreference) {
			data.theme = v
			persist(data)
		},

		get flashGrade() {
			return data.flashGrade
		},
		set flashGrade(v: string | null) {
			data.flashGrade = v
			persist(data)
		},

		get projectGrade() {
			return data.projectGrade
		},
		set projectGrade(v: string | null) {
			data.projectGrade = v
			persist(data)
		},

		get defaultAngle() {
			return data.defaultAngle
		},
		set defaultAngle(v: Angle | null) {
			data.defaultAngle = v
			persist(data)
		}
	}
}

export const settings = createSettings()
