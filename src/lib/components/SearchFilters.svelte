<script lang="ts">
	import type { ClimbFilters } from '$lib/data/types'
	import FilterToggle from './FilterToggle.svelte'
	import GradeRangeSlider from './GradeRangeSlider.svelte'

	interface Props {
		resultCount?: number
		filters: Partial<ClimbFilters>
		handleUpdateFilters: (newFilters: Partial<ClimbFilters>) => void
		handleClearFilters: () => void
	}

	let { resultCount, filters, handleUpdateFilters, handleClearFilters }: Props = $props()

	const qualityStars = [1, 2, 3] as const

	let hasActiveFilters = $derived(
		filters.gradeMin !== null ||
			filters.gradeMax !== null ||
			filters.minQuality ||
			filters.query?.trim() ||
			filters.excludeTicked ||
			filters.onlyAttempted ||
			filters.onlyLiked ||
			filters.onlyRecentlyLit ||
			filters.onlyBenchmarks ||
			filters.onlyCampus ||
			filters.onlyRoutes
	)

	let hasActiveAdvancedFilter = $derived(
		filters.minQuality || filters.onlyBenchmarks || filters.onlyCampus || filters.onlyRoutes
	)
</script>

<div class="space-y-5 p-1">
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
			value={filters.query}
			oninput={(e) => handleUpdateFilters({ ...filters, query: e.currentTarget.value })}
			class="w-full rounded-xl border border-border bg-surface-raised/60 py-2.5 pr-4 pl-9 text-sm text-text placeholder:text-muted focus:ring-cyan-500 "
		/>
	</div>

	<!-- Grade range slider -->
	<GradeRangeSlider
		gradeMin={filters.gradeMin ?? null}
		gradeMax={filters.gradeMax ?? null}
		onchange={(gradeMin, gradeMax) => handleUpdateFilters({ ...filters, gradeMin, gradeMax })}
	/>

	<!-- User log filters -->
	<div>
		<p class="mb-2 text-xs font-semibold tracking-wider text-muted uppercase">My Sends</p>
		<div class="space-y-1.5">
			<FilterToggle
				active={filters.excludeTicked ?? false}
				onclick={() => handleUpdateFilters({ ...filters, excludeTicked: !filters.excludeTicked })}
				label="Hide already ticked"
			>
				{#snippet icon()}
					<svg
						class="size-3.5 shrink-0"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
					>
						<path d="M5 13l4 4L19 7" />
					</svg>
				{/snippet}
			</FilterToggle>

			<FilterToggle
				active={filters.onlyAttempted ?? false}
				onclick={() => handleUpdateFilters({ ...filters, onlyAttempted: !filters.onlyAttempted })}
				label="Show only attempted"
			>
				{#snippet icon()}
					<svg
						class="size-3.5 shrink-0"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
					>
						<path d="M12 5v14M5 12l7-7 7 7" />
					</svg>
				{/snippet}
			</FilterToggle>

			<FilterToggle
				active={filters.onlyLiked ?? false}
				onclick={() => handleUpdateFilters({ ...filters, onlyLiked: !filters.onlyLiked })}
				label="Show only liked"
			>
				{#snippet icon()}
					<svg
						class="size-3.5 shrink-0"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
					>
						<path
							d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"
						/>
					</svg>
				{/snippet}
			</FilterToggle>

			<FilterToggle
				active={filters.onlyRecentlyLit ?? false}
				onclick={() =>
					handleUpdateFilters({ ...filters, onlyRecentlyLit: !filters.onlyRecentlyLit })}
				label="Show recently lit"
			>
				{#snippet icon()}
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
				{/snippet}
			</FilterToggle>
		</div>
	</div>

	<!-- Advanced filters -->
	<details class="group">
		<summary
			class="flex cursor-pointer list-none items-center gap-1.5 text-xs font-semibold tracking-wider text-muted uppercase select-none hover:text-text"
		>
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
			{#if hasActiveAdvancedFilter}
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
								filters.minQuality = filters.minQuality === stars ? 0 : stars
								handleUpdateFilters(filters)
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

			<div class="space-y-1.5">
				<FilterToggle
					active={filters.onlyBenchmarks ?? false}
					onclick={() =>
						handleUpdateFilters({ ...filters, onlyBenchmarks: !filters.onlyBenchmarks })}
					label="Benchmarks only"
					color="yellow"
				>
					{#snippet icon()}
						<svg class="size-3.5 shrink-0" viewBox="0 0 24 24" fill="currentColor" stroke="none">
							<path
								d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
							/>
						</svg>
					{/snippet}
				</FilterToggle>

				<FilterToggle
					active={filters.onlyCampus ?? false}
					onclick={() => handleUpdateFilters({ ...filters, onlyCampus: !filters.onlyCampus })}
					label="Campus only"
					color="purple"
				>
					{#snippet icon()}
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
					{/snippet}
				</FilterToggle>

				<FilterToggle
					active={filters.onlyRoutes ?? false}
					onclick={() => handleUpdateFilters({ ...filters, onlyRoutes: !filters.onlyRoutes })}
					label="Routes only"
					color="blue"
				>
					{#snippet icon()}
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
					{/snippet}
				</FilterToggle>
			</div>
		</div>
	</details>

	<!-- Result count + clear -->
	<div class="flex items-center justify-between border-t border-border pt-3">
		{#if resultCount !== undefined}
			<p class="text-xs text-muted">
				<span class="font-semibold text-text/80">{resultCount}</span>
				{resultCount === 1 ? 'climb' : 'climbs'}
			</p>
		{/if}
		{#if hasActiveFilters}
			<button
				onclick={handleClearFilters}
				class="text-xs text-muted underline underline-offset-2 hover:text-text"
			>
				Clear filters
			</button>
		{/if}
	</div>
</div>

<style>
	details > summary::-webkit-details-marker {
		display: none;
	}
</style>
