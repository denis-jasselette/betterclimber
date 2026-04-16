<script lang="ts">
import { searchStore } from '$lib/search-store.svelte'
import GradeRangeSlider from './GradeRangeSlider.svelte'

let { resultCount }: { resultCount: number } = $props()

const filters = searchStore.filters

const hasActiveFilters = $derived(
	filters.gradeMin !== null ||
		filters.gradeMax !== null ||
		filters.minQuality > 0 ||
		filters.query.trim().length > 0 ||
		filters.excludeTicked ||
		filters.onlyAttempted ||
		filters.onlyLiked ||
		filters.onlyRecentlyLit ||
		filters.onlyBenchmarks ||
		filters.onlyCampus ||
		filters.onlyRoutes
)

const qualityStars = [1, 2, 3] as const

// Advanced section open state — local so the user can freely toggle it
// without it snapping shut when a filter is cleared.
// It is forced open (but never forced closed) when an advanced filter becomes active.
let advancedOpen = $state(
	filters.minQuality > 0 || filters.onlyBenchmarks || filters.onlyCampus || filters.onlyRoutes
)
const hasAdvancedFilter = $derived(
	filters.minQuality > 0 || filters.onlyBenchmarks || filters.onlyCampus || filters.onlyRoutes
)
$effect(() => {
	if (hasAdvancedFilter) advancedOpen = true
})
</script>

<div class="space-y-5">
	<!-- Search box -->
	<div class="relative">
		<svg
			class="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted"
			xmlns="http://www.w3.org/2000/svg"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
		>
			<circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
		</svg>
		<input
			type="search"
			placeholder="Search by name or setter…"
			bind:value={filters.query}
			class="w-full rounded-xl border border-border bg-surface-raised/60 py-2.5 pr-4 pl-9 text-sm text-text placeholder:text-muted focus:border-cyan-500 focus:outline focus:outline-1 focus:outline-cyan-500"
		/>
	</div>

	<!-- Grade range slider -->
	<GradeRangeSlider bind:gradeMin={filters.gradeMin} bind:gradeMax={filters.gradeMax} />

	<!-- User log filters -->
	<div>
		<p class="mb-2 text-xs font-semibold tracking-wider text-muted uppercase">My Sends</p>
		<div class="space-y-1.5">
			{#snippet logToggle(active: boolean, toggle: () => void, icon: string, label: string)}
				<button
					onclick={toggle}
					class="flex w-full items-center gap-2.5 rounded-lg border px-3 py-2 text-xs font-medium transition active:scale-95 {active
						? 'border-cyan-600 bg-cyan-600/10 text-cyan-300'
						: 'border-border bg-surface-raised/60 text-muted hover:border-border hover:text-text'}"
				>
					<span
						class="flex size-5 shrink-0 items-center justify-center rounded-md border {active
							? 'border-cyan-500 bg-cyan-500/20'
							: 'border-border bg-surface-raised'}"
					>
						{#if active}
							<svg
								class="size-3 text-cyan-400"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2.5"><path d="M5 13l4 4L19 7" /></svg
							>
						{/if}
					</span>
					<svg
						class="size-3.5 shrink-0"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
					>
						<path d={icon} />
					</svg>
					{label}
				</button>
			{/snippet}

			{@render logToggle(
				filters.excludeTicked,
				() => (filters.excludeTicked = !filters.excludeTicked),
				'M5 13l4 4L19 7',
				'Hide already ticked'
			)}
			{@render logToggle(
				filters.onlyAttempted,
				() => (filters.onlyAttempted = !filters.onlyAttempted),
				'M12 5v14M5 12l7-7 7 7',
				'Show only attempted'
			)}
			{@render logToggle(
				filters.onlyLiked,
				() => (filters.onlyLiked = !filters.onlyLiked),
				'M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z',
				'Show only liked'
			)}
			<button
				onclick={() => (filters.onlyRecentlyLit = !filters.onlyRecentlyLit)}
				class="flex w-full items-center gap-2.5 rounded-lg border px-3 py-2 text-xs font-medium transition active:scale-95 {filters.onlyRecentlyLit
					? 'border-cyan-600 bg-cyan-600/10 text-cyan-300'
					: 'border-border bg-surface-raised/60 text-muted hover:border-border hover:text-text'}"
			>
				<span
					class="flex size-5 shrink-0 items-center justify-center rounded-md border {filters.onlyRecentlyLit
						? 'border-cyan-500 bg-cyan-500/20'
						: 'border-border bg-surface-raised'}"
				>
					{#if filters.onlyRecentlyLit}
						<svg
							class="size-3 text-cyan-400"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2.5"
						>
							<path d="M5 13l4 4L19 7" />
						</svg>
					{/if}
				</span>
				<!-- History / clock-with-arrow icon -->
				<svg
					class="size-3.5 shrink-0"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
				>
					<path d="M3 3v5h5" />
					<path d="M3.05 13A9 9 0 1 0 6 5.3L3 8" />
					<path d="M12 7v5l4 2" />
				</svg>
				Show recently lit
			</button>
		</div>
	</div>

	<!-- Advanced filters -->
	<details
		open={advancedOpen}
		ontoggle={(e) => (advancedOpen = (e.currentTarget as HTMLDetailsElement).open)}
		class="group"
	>
		<summary
			class="flex cursor-pointer list-none items-center gap-1.5 text-xs font-semibold tracking-wider text-muted uppercase select-none hover:text-text"
		>
			<!-- chevron rotates when open -->
			<svg
				class="size-3.5 shrink-0 transition-transform group-open:rotate-90"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2.5"
			>
				<path d="m9 18 6-6-6-6" />
			</svg>
			Advanced
			<!-- dot indicator when a filter inside is active -->
			{#if filters.minQuality > 0 || filters.onlyBenchmarks || filters.onlyCampus || filters.onlyRoutes}
				<span class="ml-0.5 size-1.5 rounded-full bg-cyan-400"></span>
			{/if}
		</summary>

		<div class="mt-3 space-y-4">
			<!-- Minimum quality -->
			<div>
				<p class="mb-2 text-xs font-semibold tracking-wider text-muted uppercase">Min. Quality</p>
				<div class="flex gap-1.5">
					{#each qualityStars as stars (stars)}
						<button
							onclick={() => {
								filters.minQuality = filters.minQuality === stars ? 0 : stars;
							}}
							class="flex items-center gap-1 rounded-lg border px-3 py-1 text-xs font-semibold transition active:scale-95 {filters.minQuality ===
							stars
								? 'border-yellow-500 bg-yellow-500/20 text-yellow-300'
								: 'border-border bg-surface-raised text-muted hover:border-border hover:text-text'}"
						>
							{#each Array.from({ length: stars }, (_, i) => i) as i (i)}
								<svg
									class="size-3"
									xmlns="http://www.w3.org/2000/svg"
									viewBox="0 0 24 24"
									fill="currentColor"
								>
									<path
										d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
									/>
								</svg>
							{/each}
							+
						</button>
					{/each}
				</div>
			</div>

			<!-- Benchmarks only -->
			<button
				onclick={() => (filters.onlyBenchmarks = !filters.onlyBenchmarks)}
				class="flex w-full items-center gap-2.5 rounded-lg border px-3 py-2 text-xs font-medium transition active:scale-95 {filters.onlyBenchmarks
					? 'border-yellow-500 bg-yellow-500/10 text-yellow-300'
					: 'border-border bg-surface-raised/60 text-muted hover:border-border hover:text-text'}"
			>
				<span
					class="flex size-5 shrink-0 items-center justify-center rounded-md border {filters.onlyBenchmarks
						? 'border-yellow-500 bg-yellow-500/20'
						: 'border-border bg-surface-raised'}"
				>
					{#if filters.onlyBenchmarks}
						<svg
							class="size-3 text-yellow-400"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2.5"
						>
							<path d="M5 13l4 4L19 7" />
						</svg>
					{/if}
				</span>
				<svg class="size-3.5 shrink-0" viewBox="0 0 24 24" fill="currentColor" stroke="none">
					<path
						d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
					/>
				</svg>
				Benchmarks only
			</button>

			<!-- Campus only -->
			<button
				onclick={() => (filters.onlyCampus = !filters.onlyCampus)}
				class="flex w-full items-center gap-2.5 rounded-lg border px-3 py-2 text-xs font-medium transition active:scale-95 {filters.onlyCampus
					? 'border-purple-500 bg-purple-500/10 text-purple-300'
					: 'border-border bg-surface-raised/60 text-muted hover:border-border hover:text-text'}"
			>
				<span
					class="flex size-5 shrink-0 items-center justify-center rounded-md border {filters.onlyCampus
						? 'border-purple-500 bg-purple-500/20'
						: 'border-border bg-surface-raised'}"
				>
					{#if filters.onlyCampus}
						<svg
							class="size-3 text-purple-400"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2.5"
						>
							<path d="M5 13l4 4L19 7" />
						</svg>
					{/if}
				</span>
				<!-- Biceps flexed (💪) icon -->
				<svg
					class="size-3.5 shrink-0"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<path
						d="M12.409 13.017A5 5 0 0 1 22 15c0 3.866-4 7-9 7-4.077 0-8.153-.82-10.371-2.462-.426-.316-.631-.832-.62-1.362C2.118 12.723 2.627 2 10 2a3 3 0 0 1 3 3 2 2 0 0 1-2 2c-1.105 0-1.64-.444-2-1"
					/>
					<path d="M15 14a5 5 0 0 0-7.584 2" />
					<path d="M9.964 6.825C8.019 7.977 9.5 13 8 15" />
				</svg>
				Campus only
			</button>

			<!-- Routes only -->
			<button
				onclick={() => (filters.onlyRoutes = !filters.onlyRoutes)}
				class="flex w-full items-center gap-2.5 rounded-lg border px-3 py-2 text-xs font-medium transition active:scale-95 {filters.onlyRoutes
					? 'border-blue-500 bg-blue-500/10 text-blue-300'
					: 'border-border bg-surface-raised/60 text-muted hover:border-border hover:text-text'}"
			>
				<span
					class="flex size-5 shrink-0 items-center justify-center rounded-md border {filters.onlyRoutes
						? 'border-blue-500 bg-blue-500/20'
						: 'border-border bg-surface-raised'}"
				>
					{#if filters.onlyRoutes}
						<svg
							class="size-3 text-blue-400"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2.5"
						>
							<path d="M5 13l4 4L19 7" />
						</svg>
					{/if}
				</span>
				<!-- Route icon (Lucide "route") -->
				<svg
					class="size-3.5 shrink-0"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<circle cx="6" cy="19" r="3" />
					<path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15" />
					<circle cx="18" cy="5" r="3" />
				</svg>
				Routes only
			</button>
		</div>
	</details>

	<!-- Result count + clear -->
	<div class="flex items-center justify-between border-t border-border pt-3">
		<p class="text-xs text-muted">
			<span class="font-semibold text-text/80">{resultCount}</span>
			{resultCount === 1 ? 'climb' : 'climbs'}
		</p>
		{#if hasActiveFilters}
			<button
				onclick={() => searchStore.clearFilters()}
				class="text-xs text-muted underline underline-offset-2 hover:text-text"
			>
				Clear filters
			</button>
		{/if}
	</div>
</div>

<style>
	/* Remove the default marker/triangle on all browsers */
	details > summary::-webkit-details-marker {
		display: none;
	}
</style>
