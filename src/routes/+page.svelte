<script lang="ts">
	import { onMount } from 'svelte'
	import { afterNavigate, beforeNavigate } from '$app/navigation'
	import ClimbCard from '$lib/components/ClimbCard.svelte'
	import SearchFilters from '$lib/components/SearchFilters.svelte'
	import TopBar from '$lib/components/TopBar.svelte'
	import VirtualList from '$lib/components/VirtualList.svelte'
	import { connector } from '$lib/connector.svelte'
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

	afterNavigate(() => {
		filters = data.filters
	})

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

	$effect(() => {
		loadingResults = true
		let cancelled = false
		searchClimbs(filters, data.angle).then((climbs) => {
			if (cancelled) return
			displayedClimbs = climbs
			resultsStore.list = climbs
			loadingResults = false
		})
		return () => {
			cancelled = true
		}
	})

	// ── Scroll position save / restore around climb detail navigation ─────────
	const SCROLL_KEY = 'kilter-scroll'

	beforeNavigate(({ to }) => {
		if (to?.url.pathname.startsWith('/climb/')) {
			sessionStorage.setItem(SCROLL_KEY, String(window.scrollY))
		}
	})

	afterNavigate(({ from }) => {
		if (from?.url.pathname.startsWith('/climb/')) {
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

	<div class="mx-auto flex max-w-6xl gap-6 px-4 py-6">
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
			class="scrollbar-subtle fixed right-0 bottom-0 left-0 z-40 max-h-[85vh] overflow-x-hidden overflow-y-auto rounded-t-2xl border-t border-border bg-bg p-5 transition-transform duration-300 md:sticky md:top-20 md:block md:h-[calc(100vh-5rem)] md:max-h-none md:w-72 md:shrink-0 md:translate-y-0 md:overflow-y-auto md:rounded-none md:border-none md:p-0 {filterDrawerOpen
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
				<SearchFilters {filters} {handleUpdateFilters} {handleClearFilters} />
			</div>
		</aside>

		<!-- Climb list -->
		<main class="min-w-0 flex-1 p-1">
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
					<VirtualList items={displayedClimbs} pageSize={20} key={(item) => item.climb.uuid}>
						{#snippet children(item)}
							<ClimbCard
								{item}
								{connector}
								angle={data.angle}
								href="/climb/{item.climb.uuid}?{filtersToParams(data.angle, filters)}"
							/>
						{/snippet}
					</VirtualList>
				</div>
			{/if}
		</main>
	</div>
</div>
