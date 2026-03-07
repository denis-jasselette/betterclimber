import { browser } from '$app/environment';
import type { ClimbFilters } from '$lib/data/types';

// ── Reactive singleton — survives SvelteKit client-side navigation ────────────
// angle + filters are persisted to localStorage so they survive hard reloads.

const STORAGE_KEY = 'kilter-search';

const FILTER_DEFAULTS: ClimbFilters = {
	gradeMin: null,
	gradeMax: null,
	minQuality: 0,
	query: '',
	excludeTicked: false,
	onlyAttempted: false,
	onlyLiked: false,
	onlyBenchmarks: false,
	onlyCampus: false,
	onlyRoutes: false,
	onlyRecentlyLit: false
};

function loadState(): { angle: number | null; filters: ClimbFilters } {
	if (!browser) return { angle: null, filters: { ...FILTER_DEFAULTS } };
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return { angle: null, filters: { ...FILTER_DEFAULTS } };
		const parsed = JSON.parse(raw);
		return {
			angle: typeof parsed.angle === 'number' ? parsed.angle : null,
			// Merge with defaults so new fields added later get their default value
			filters: { ...FILTER_DEFAULTS, ...parsed.filters }
		};
	} catch {
		return { angle: null, filters: { ...FILTER_DEFAULTS } };
	}
}

function saveState(angle: number | null, filters: ClimbFilters) {
	if (!browser) return;
	localStorage.setItem(STORAGE_KEY, JSON.stringify({ angle, filters }));
}

function createSearchStore() {
	const initial = loadState();

	let angle = $state<number | null>(initial.angle);
	let filters = $state<ClimbFilters>(initial.filters);

	// Persist whenever angle or any filter field changes.
	// $effect.root() creates an effect outside any component context — required
	// for module-level singletons.  The cleanup function it returns is a no-op
	// here because the store lives for the lifetime of the page.
	$effect.root(() => {
		$effect(() => {
			saveState(angle, { ...filters });
		});
	});

	return {
		get angle() { return angle; },
		set angle(v: number | null) { angle = v; },

		get filters() { return filters; },

		setGradeMin(v: string | null)  { filters.gradeMin = v; },
		setGradeMax(v: string | null)  { filters.gradeMax = v; },
		setMinQuality(v: number)       { filters.minQuality = v; },
		setQuery(v: string)            { filters.query = v; },
		setExcludeTicked(v: boolean)   { filters.excludeTicked = v; },
		setOnlyAttempted(v: boolean)   { filters.onlyAttempted = v; },
		setOnlyLiked(v: boolean)       { filters.onlyLiked = v; },
		setOnlyBenchmarks(v: boolean)  { filters.onlyBenchmarks = v; },
		setOnlyCampus(v: boolean)      { filters.onlyCampus = v; },
		setOnlyRoutes(v: boolean)      { filters.onlyRoutes = v; },
		setOnlyRecentlyLit(v: boolean) { filters.onlyRecentlyLit = v; },

		clearFilters() {
			filters.gradeMin = null;
			filters.gradeMax = null;
			filters.minQuality = 0;
			filters.query = '';
			filters.excludeTicked = false;
			filters.onlyAttempted = false;
			filters.onlyLiked = false;
			filters.onlyBenchmarks = false;
			filters.onlyCampus = false;
			filters.onlyRoutes = false;
			filters.onlyRecentlyLit = false;
		}
	};
}

export const searchStore = createSearchStore();
