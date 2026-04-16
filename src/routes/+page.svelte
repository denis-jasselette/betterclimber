<script lang="ts">
import { onMount, untrack } from 'svelte'
import { afterNavigate, beforeNavigate, replaceState } from '$app/navigation'
import ClimbCard from '$lib/components/ClimbCard.svelte'
import SearchFilters from '$lib/components/SearchFilters.svelte'
import TopBar from '$lib/components/TopBar.svelte'
import VirtualList from '$lib/components/VirtualList.svelte'
import { connector } from '$lib/connector.svelte'
import { searchClimbs } from '$lib/data/repository'
import type { ClimbWithStats } from '$lib/data/types'
import { resultsStore } from '$lib/results-store.svelte'
import { searchStore } from '$lib/search-store.svelte'
import { filtersToParams } from './+page'

let { data } = $props()

// ── Init store from URL filters (bookmarks / shared links / refresh) ──────
// URL filter params take precedence over stale localStorage state when the
// URL carries explicit values (i.e. user arrived via a bookmark or shared URL).
untrack(() => {
	if (data.angle !== null) searchStore.angle = data.angle
	const f = data.filters ?? {}
	if (f.query !== undefined) searchStore.setQuery(f.query)
	if (f.gradeMin !== undefined) searchStore.setGradeMin(f.gradeMin ?? null)
	if (f.gradeMax !== undefined) searchStore.setGradeMax(f.gradeMax ?? null)
	if (f.minQuality !== undefined) searchStore.setMinQuality(f.minQuality)
	if (f.onlyBenchmarks !== undefined) searchStore.setOnlyBenchmarks(f.onlyBenchmarks)
	if (f.onlyCampus !== undefined) searchStore.setOnlyCampus(f.onlyCampus)
	if (f.onlyRoutes !== undefined) searchStore.setOnlyRoutes(f.onlyRoutes)
})
$effect(() => {
	const a = data.angle
	if (a !== null && a !== searchStore.angle) searchStore.angle = a
})

// The "effective" angle for rendering: prefer the load-function value on
// initial paint (before the store $effect has fired) so nothing flashes.
const effectiveAngle = $derived(data.angle !== null ? data.angle : searchStore.angle)

// ── Sync shareable filters to URL (replaceState — no history entry) ───────
$effect(() => {
	const params = filtersToParams(searchStore.angle, searchStore.filters)
	const qs = params.toString()
	replaceState(qs ? `?${qs}` : '?', {})
})

// ── Results ──────────────────────────────────────────────────────────────
let results = $state<ClimbWithStats[]>(untrack(() => data.results ?? []))
let loading = $state(false)

untrack(() => {
	resultsStore.list = data.results ?? []
})

// ── Mobile filter drawer ─────────────────────────────────────────────────
let filterDrawerOpen = $state(false)

// ── Search (re-runs whenever store angle or filters change) ──────────────
$effect(() => {
	const angle = searchStore.angle

	if (angle === null) {
		results = []
		loading = false
		return
	}

	const snapshot = {
		gradeMin: searchStore.filters.gradeMin,
		gradeMax: searchStore.filters.gradeMax,
		minQuality: searchStore.filters.minQuality,
		query: searchStore.filters.query,
		excludeTicked: searchStore.filters.excludeTicked,
		onlyAttempted: searchStore.filters.onlyAttempted,
		onlyLiked: searchStore.filters.onlyLiked,
		onlyBenchmarks: searchStore.filters.onlyBenchmarks,
		onlyCampus: searchStore.filters.onlyCampus,
		onlyRoutes: searchStore.filters.onlyRoutes,
		onlyRecentlyLit: searchStore.filters.onlyRecentlyLit
	}

	loading = true
	searchClimbs(snapshot, angle).then((r) => {
		results = r
		resultsStore.list = r
		loading = false
	})
})

// ── Scroll position save / restore ────────────────────────────────────────
const SCROLL_KEY = 'kilter-scroll'

beforeNavigate(({ to }) => {
	// Save scroll position when navigating to a climb detail page.
	if (to?.url.pathname.startsWith('/climb/')) {
		sessionStorage.setItem(SCROLL_KEY, String(window.scrollY))
	}
})

afterNavigate(({ from }) => {
	// Restore scroll position when returning from a climb detail page.
	if (from?.url.pathname.startsWith('/climb/')) {
		const y = Number(sessionStorage.getItem(SCROLL_KEY) ?? '0')
		// rAF ensures the list has rendered before scrolling.
		requestAnimationFrame(() => window.scrollTo({ top: y, behavior: 'instant' }))
	}
})

// ── PWA update notification ──────────────────────────────────────────────
let updateAvailable = $state(false)
onMount(async () => {
	if ('serviceWorker' in navigator) {
		const { registerSW } = await import('virtual:pwa-register')
		registerSW({
			onNeedRefresh() {
				updateAvailable = true
			}
		})
	}
})

function reloadForUpdate() {
	window.location.reload()
}
</script>

<svelte:head>
	<title>Kilterboard Search</title>
	<meta name="description" content="Search Kilter Board climbs and send them to your board." />
</svelte:head>

<!-- PWA update toast -->
{#if updateAvailable}
	<div
		class="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-2xl border border-cyan-700 bg-surface px-5 py-3 shadow-2xl"
	>
		<div class="flex items-center gap-3">
			<p class="text-sm text-text">App update available.</p>
			<button
				onclick={reloadForUpdate}
				class="rounded-lg bg-cyan-600 px-3 py-1 text-xs font-semibold text-white hover:bg-cyan-500"
			>
				Reload
			</button>
		</div>
	</div>
{/if}

<div class="min-h-screen bg-bg text-text">
	<!-- Top bar — pass data.angle so the dropdown shows the correct value on
	     hard-refresh before the store has been synced from the URL -->
	<TopBar angle={data.angle}>
		<!-- Filter toggle (mobile) -->
		<button
			onclick={() => (filterDrawerOpen = !filterDrawerOpen)}
			aria-label="Toggle filters"
			class="relative flex h-9 items-center gap-1.5 rounded-xl border border-border bg-surface-raised px-3 text-sm font-semibold text-muted transition hover:border-border hover:text-text md:hidden"
		>
			<svg
				class="size-4"
				xmlns="http://www.w3.org/2000/svg"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
			>
				<line x1="4" y1="6" x2="20" y2="6" />
				<line x1="8" y1="12" x2="16" y2="12" />
				<line x1="11" y1="18" x2="13" y2="18" />
			</svg>
			<span class="hidden sm:inline">Filters</span>
			{#if searchStore.filters.gradeMin !== null || searchStore.filters.gradeMax !== null || searchStore.filters.minQuality > 0 || searchStore.filters.excludeTicked || searchStore.filters.onlyAttempted || searchStore.filters.onlyLiked}
				<span
					class="absolute -top-1.5 -right-1.5 flex size-4 items-center justify-center rounded-full bg-cyan-500 text-[10px] font-bold text-white"
				>
					{[
						searchStore.filters.gradeMin !== null || searchStore.filters.gradeMax !== null,
						searchStore.filters.minQuality > 0,
						searchStore.filters.excludeTicked,
						searchStore.filters.onlyAttempted,
						searchStore.filters.onlyLiked
					].filter(Boolean).length}
				</span>
			{/if}
		</button>
	</TopBar>

	<div class="mx-auto flex max-w-6xl gap-6 px-4 py-6">
		<!-- Sidebar (desktop) / Drawer (mobile) -->

		<!-- Mobile overlay -->
		{#if filterDrawerOpen}
			<div
				role="button"
				tabindex="-1"
				class="fixed inset-0 z-30 bg-black/60 md:hidden"
				onclick={() => (filterDrawerOpen = false)}
				onkeydown={(e) => e.key === 'Escape' && (filterDrawerOpen = false)}
			></div>
		{/if}

		<!-- Filter panel -->
		<aside
			class="fixed right-0 bottom-0 left-0 z-40 max-h-[85vh] overflow-x-hidden overflow-y-auto rounded-t-2xl border-t border-border bg-bg p-5 transition-transform duration-300 md:sticky md:top-20 md:block md:max-h-none md:w-72 md:shrink-0 md:translate-y-0 md:rounded-none md:border-none md:p-0 {filterDrawerOpen
				? 'translate-y-0'
				: 'translate-y-full md:translate-y-0'}"
		>
			<!-- Mobile drag handle -->
			<div class="mb-4 flex items-center justify-between md:hidden">
				<span class="text-sm font-semibold text-text">Filters</span>
				<button
					onclick={() => (filterDrawerOpen = false)}
					aria-label="Close filters"
					class="rounded-lg p-1 text-muted hover:text-text"
				>
					<svg
						class="size-5"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
					>
						<path d="M18 6 6 18M6 6l12 12" />
					</svg>
				</button>
			</div>

			<div class="space-y-5">
				<!-- Filters -->
				<SearchFilters resultCount={results.length} />
			</div>
		</aside>

		<!-- Climb list -->
		<main class="min-w-0 flex-1">
			{#if effectiveAngle === null}
				<!-- No angle selected yet -->
				<div class="flex flex-col items-center gap-4 py-24 text-center">
					<svg
						class="size-14 text-muted"
						xmlns="http://www.w3.org/2000/svg"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="1.5"
					>
						<path d="M3 20h18M3 20 12 4l9 16" />
					</svg>
					<p class="text-base font-semibold text-muted">Select an angle to get started</p>
					<p class="text-sm text-muted/70">
						Use the angle picker in the top bar to choose your board angle.
					</p>
				</div>
			{:else if loading}
				<!-- Skeleton cards -->
				<div class="space-y-3">
					{#each [1, 2, 3, 4, 5] as i (i)}
						<div class="h-36 animate-pulse rounded-2xl border border-border bg-surface"></div>
					{/each}
				</div>
			{:else if results.length === 0}
				<div class="flex flex-col items-center gap-3 py-20 text-center">
					<svg
						class="size-12 text-muted"
						xmlns="http://www.w3.org/2000/svg"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="1.5"
					>
						<circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
					</svg>
					<p class="text-sm font-medium text-muted">No climbs match your filters.</p>
					<p class="text-xs text-muted/70">Try broadening your grade range or quality filter.</p>
				</div>
			{:else}
				<div class="space-y-3">
					<VirtualList items={results} pageSize={20} key={(item) => item.climb.uuid}>
						{#snippet children(item)}
							<ClimbCard
								{item}
								{connector}
								href="/climb/{item.climb.uuid}{effectiveAngle !== null
									? `?angle=${effectiveAngle}`
									: ''}"
							/>
						{/snippet}
					</VirtualList>
				</div>
			{/if}
		</main>
	</div>
</div>
