<script lang="ts">
	import { onMount, untrack } from 'svelte'
	import { afterNavigate, beforeNavigate } from '$app/navigation'
	import ClimbCard from '$lib/components/ClimbCard.svelte'
	import SearchFilters from '$lib/components/SearchFilters.svelte'
	import TopBar from '$lib/components/TopBar.svelte'
	import VirtualList from '$lib/components/VirtualList.svelte'
	import { connector } from '$lib/connector.svelte'
	import { type CustomClimb, filterCustomClimbs, getCustomClimbs } from '$lib/data/custom-climbs'
	import { searchClimbs } from '$lib/data/repository'
	import type { ClimbFilters, ClimbWithStats } from '$lib/data/types'
	import { resultsStore } from '$lib/results-store.svelte'
	import { filtersToParams } from '$lib/url-filters'

	let { data } = $props()

	let filterDrawerOpen = $state(false)

	function toggleFilterDrawerOpen() {
		filterDrawerOpen = !filterDrawerOpen
	}

	function closeFilterDrawer() {
		filterDrawerOpen = false
	}

	// ── Local filter state — drives the UI immediately ────────────────────────
	// Initialised from server data so hard-reload / paste URL restores state.
	// afterNavigate re-syncs on real navigations (angle change via goto) without
	// firing on our own replaceState calls (shallow routing).
	// The URL is kept in sync via replaceState as an external side-effect.
	// eslint-disable-next-line svelte/prefer-writable-derived
	// svelte-ignore state_referenced_locally — intentional: afterNavigate handles re-sync
	let filters = $state<Partial<ClimbFilters>>(data.filters)

	// ── Custom climbs (localStorage, client-only) ─────────────────────────────
	let allCustomClimbs = $state<CustomClimb[]>([])
	onMount(() => {
		allCustomClimbs = getCustomClimbs()
	})
	const customResults = $derived(filterCustomClimbs(allCustomClimbs, filters, data.angle))
	const customUuids = $derived(new Set(customResults.map((r) => r.climb.uuid)))

	$effect(() => {
		// Keep the URL in sync as a side-effect.
		// Use raw history.replaceState (not SvelteKit's replaceState) so the address bar
		// updates without re-running the load function. Pass history.state to preserve
		// SvelteKit's internal router state on the history entry.
		const url = new URL(window.location.href)
		url.search = filtersToParams(data.angle, filters).toString()
		history.replaceState(history.state, '', url)
	})

	let activeFilterCount = $derived(
		[
			filters.query?.trim() ||
				filters.authorQuery?.trim() ||
				filters.nameQuery?.trim() ||
				filters.descriptionQuery?.trim(),
			filters.gradeMin != null || filters.gradeMax != null,
			filters.minQuality,
			filters.excludeTicked,
			filters.onlyAttempted,
			filters.onlyLiked,
			filters.onlyBenchmarks,
			filters.onlyCampus,
			filters.onlyRoutes,
			filters.onlyRecentlyLit
		].filter(Boolean).length
	)

	function handleUpdateFilters(newFilters: Partial<ClimbFilters> = {}) {
		filters = newFilters
	}

	function handleClearFilters() {
		filters = {}
	}

	// ── Displayed results: keep previous list visible while new results load ──
	// eslint-disable-next-line svelte/prefer-writable-derived
	let displayedClimbs = $state<ClimbWithStats[]>([])
	let loadingResults = $state(true)
	let loadingMore = $state(false)
	let nextCursor = $state<string | null>(null)
	// Incremented on each new search — passed to VirtualList so it resets visible count.
	let searchToken = $state<object>({})
	// Passed to VirtualList when restoring a previous browse session so it starts
	// showing all accumulated items without resetting to pageSize.
	let restoredVisibleCount = $state(0)

	// Set to true by afterNavigate (back from climb) before filters are updated.
	// Checked inside the search effect (via untrack) to skip the API call.
	// Cleared by the setTimeout in afterNavigate after all effects have run.
	let skipNextSearch = false

	$effect(() => {
		// Establish reactive dependencies on filters + angle.
		const _filters = filters
		const _angle = data.angle

		// When coming back from a climb detail page the browse state is restored
		// synchronously in afterNavigate — no new API call needed.
		if (untrack(() => skipNextSearch)) return

		loadingResults = true
		nextCursor = null
		searchToken = {}
		restoredVisibleCount = 0
		let cancelled = false
		searchClimbs(_filters, _angle, null).then(({ climbs, nextCursor: nc }) => {
			if (cancelled) return
			displayedClimbs = climbs
			nextCursor = nc
			// Custom climbs prepended for prev/next navigation
			resultsStore.list = [...customResults, ...climbs]
			loadingResults = false
		})
		return () => {
			cancelled = true
		}
	})

	async function loadMoreClimbs() {
		if (!nextCursor || loadingMore) return
		loadingMore = true
		const { climbs: newClimbs, nextCursor: nc } = await searchClimbs(
			filters,
			data.angle,
			nextCursor
		)
		displayedClimbs = [...displayedClimbs, ...newClimbs]
		nextCursor = nc
		resultsStore.list = displayedClimbs
		loadingMore = false
	}

	// ── Scroll position + browse state save / restore around climb navigation ─
	const SCROLL_KEY = 'kilter-scroll'
	const BROWSE_STATE_KEY = 'kilter-browse-state'

	interface BrowseState {
		nextCursor: string | null
		displayedCount: number
	}

	beforeNavigate(({ to }) => {
		if (to?.url.pathname.startsWith('/climb/')) {
			sessionStorage.setItem(SCROLL_KEY, String(window.scrollY))
			// Persist cursor + item count so we can restore without re-fetching.
			const state: BrowseState = { nextCursor, displayedCount: displayedClimbs.length }
			sessionStorage.setItem(BROWSE_STATE_KEY, JSON.stringify(state))
		}
	})

	afterNavigate(({ from }) => {
		const comingBackFromClimb = from?.url.pathname.startsWith('/climb/')

		if (comingBackFromClimb) {
			// Prevent the search $effect (triggered by the filters update below) from
			// firing a new API call — we're restoring the previous browse session.
			skipNextSearch = true
			// Always clear the flag on the next tick so future filter changes work.
			setTimeout(() => {
				skipNextSearch = false
			}, 0)
		}

		// Keep filters in sync with the URL on all navigations (e.g. angle change).
		filters = data.filters
		// Reload custom climbs on every navigation (user may have just created/deleted one).
		allCustomClimbs = getCustomClimbs()

		if (comingBackFromClimb) {
			// Restore the accumulated result list and cursor from the previous visit.
			// resultsStore.list already contains all pages fetched before navigation.
			const raw = sessionStorage.getItem(BROWSE_STATE_KEY)
			if (raw) {
				try {
					const saved = JSON.parse(raw) as BrowseState
					displayedClimbs = resultsStore.list.slice(0, saved.displayedCount)
					nextCursor = saved.nextCursor
					restoredVisibleCount = saved.displayedCount
				} catch {
					displayedClimbs = resultsStore.list
					nextCursor = null
					restoredVisibleCount = resultsStore.list.length
				}
			} else {
				// No saved state (e.g. session storage cleared) — show all known results.
				displayedClimbs = resultsStore.list
				nextCursor = null
				restoredVisibleCount = resultsStore.list.length
			}
			loadingResults = false

			const y = Number(sessionStorage.getItem(SCROLL_KEY) ?? '0')
			setTimeout(() => window.scrollTo({ top: y, behavior: 'instant' }), 0)
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
	<title>BetterClimber</title>
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

<!-- Top bar — pass data.angle so the dropdown shows the correct value on
     hard-refresh before the store has been synced from the URL -->
<TopBar angle={data.angle}>
	<!-- Filter toggle (mobile) -->
	<button
		type="button"
		onclick={toggleFilterDrawerOpen}
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
		{#if activeFilterCount > 0}
			<span
				class="absolute -top-1.5 -right-1.5 flex size-4 items-center justify-center rounded-full bg-cyan-500 text-[10px] font-bold text-white"
			>
				{activeFilterCount}
			</span>
		{/if}
	</button>
</TopBar>

<div class="mx-auto grid w-full max-w-6xl grid-cols-1 gap-6 px-4 py-6 md:grid-cols-[18rem_1fr]">
		<!-- Sidebar (desktop) / Drawer (mobile) -->

		<!-- Mobile overlay -->
		{#if filterDrawerOpen}
			<div
				role="button"
				tabindex="-1"
				class="fixed inset-0 z-30 bg-black/60 md:hidden"
				onclick={closeFilterDrawer}
				onkeydown={(e) => e.key === 'Escape' && closeFilterDrawer()}
			></div>
		{/if}

		<!-- Filter panel -->
		<aside
			class="scrollbar-subtle fixed right-0 bottom-0 left-0 z-40 max-h-[85vh] overflow-x-hidden overflow-y-auto rounded-t-2xl border-t border-border bg-bg p-5 transition-transform duration-300 md:sticky md:inset-auto md:top-20 md:block md:h-[calc(100vh-5rem)] md:max-h-none md:w-72 md:min-w-72 md:shrink-0 md:translate-y-0 md:overflow-y-auto md:rounded-none md:border-none md:p-0 {filterDrawerOpen
				? 'translate-y-0'
				: 'translate-y-full md:translate-y-0'}"
		>
			<!-- Mobile drag handle -->
			<div class="mb-4 flex items-center justify-between md:hidden">
				<span class="text-sm font-semibold text-text">Filters</span>
				<button
					type="button"
					onclick={closeFilterDrawer}
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
				<SearchFilters {filters} resultCount={displayedClimbs.length} {handleUpdateFilters} {handleClearFilters} />
			</div>
		</aside>

		<!-- Climb list -->
		<main class="min-h-96 min-w-0 p-1">
			{#if displayedClimbs.length === 0 && loadingResults}
				<!-- Skeleton cards shown only on first load -->
				<div class="space-y-3">
					{#each [1, 2, 3, 4, 5] as i (i)}
						<div class="h-36 animate-pulse rounded-2xl border border-border bg-surface"></div>
					{/each}
				</div>
			{:else if displayedClimbs.length === 0}
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
				<div class="space-y-3" class:opacity-60={loadingResults}>
					<!-- Custom climbs at the top (author shown as @me in accent color) -->
					{#each customResults as item (item.climb.uuid)}
						<ClimbCard
							{item}
							{connector}
							angle={data.angle}
							href="/climb/{item.climb.uuid}?{filtersToParams(data.angle, filters)}"
						/>
					{/each}

					<VirtualList
						items={displayedClimbs}
						pageSize={20}
						key={(item) => item.climb.uuid}
						onLoadMore={nextCursor ? loadMoreClimbs : undefined}
						resetToken={searchToken}
						initialVisibleCount={restoredVisibleCount}
					>
						{#snippet children(item)}
							{#if customUuids.has(item.climb.uuid)}
								<!-- skip — already shown above -->
							{:else}
								<ClimbCard
									{item}
									{connector}
									angle={data.angle}
									href="/climb/{item.climb.uuid}?{filtersToParams(data.angle, filters)}"
								/>
							{/if}
						{/snippet}
					</VirtualList>
				</div>
			{/if}
		</main>
</div>

