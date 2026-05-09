<script lang="ts">
	import { goto } from '$app/navigation'
	import { page } from '$app/state'
	import TopBar from '$lib/components/TopBar.svelte'
	import type { Angle, ClimbWithStats } from '$lib/data/types'
	import { ALL_ANGLES, difficultyToGrade, formatGrade } from '$lib/data/types'
	import { playlistsStore } from '$lib/playlists-store.svelte'
	import { settings } from '$lib/settings-store.svelte'

	let { data } = $props()

	const playlist = $derived(data.playlist)
	const climbs = $derived(data.climbs as ClimbWithStats[])

	// Session mode: navigate between climbs in the playlist
	const angle = $derived(
		(() => {
			const raw = page.url.searchParams.get('angle')
			const parsed = Number(raw)
			return raw !== null && (ALL_ANGLES as ReadonlyArray<number>).includes(parsed)
				? (parsed as Angle)
				: null
		})()
	)

	let removingUuid = $state<string | null>(null)

	async function removeClimb(climbUuid: string) {
		if (!playlist) return
		removingUuid = climbUuid
		await playlistsStore.removeClimb(playlist.id, climbUuid)
		// Navigate to refresh the page
		goto(`/playlists/${playlist.id}`, { invalidateAll: true })
	}

	function grade(climb: ClimbWithStats): string {
		if (!climb.activeStats) return '?'
		return formatGrade(
			difficultyToGrade(climb.activeStats.difficulty_average),
			settings.gradingSystem
		)
	}

	const angleSearch = $derived(angle !== null ? `?angle=${angle}` : '')
</script>

<svelte:head>
	<title>{playlist?.name ?? 'Playlist'} — Kilterboard</title>
</svelte:head>

<div class="min-h-screen bg-bg text-text">
	<TopBar {angle} />

	<div class="mx-auto max-w-2xl px-4 py-6">
		<!-- Header -->
		<div class="mb-6">
			<a href="/playlists" class="text-sm text-muted transition hover:text-text">← Playlists</a>
			{#if playlist}
				<h1 class="mt-2 text-2xl font-bold text-text">{playlist.name}</h1>
				<p class="mt-0.5 text-sm text-muted">
					{climbs.length}
					{climbs.length === 1 ? 'climb' : 'climbs'}
				</p>
			{/if}
		</div>

		{#if !playlist}
			<div class="py-16 text-center">
				<p class="text-muted">Playlist not found.</p>
				<a href="/playlists" class="mt-2 block text-sm underline underline-offset-2 hover:text-text"
					>Back to playlists</a
				>
			</div>
		{:else if climbs.length === 0}
			<div class="py-16 text-center">
				<p class="text-muted">This playlist is empty.</p>
				<p class="mt-1 text-sm text-muted">
					Add climbs using the "Add to playlist" button on any climb detail page.
				</p>
			</div>
		{:else}
			<div class="space-y-2">
				{#each climbs as item, idx (item.climb.uuid)}
					<div
						class="flex items-center gap-3 rounded-2xl border border-border bg-surface px-4 py-3 transition hover:border-border"
					>
						<!-- Position -->
						<span class="shrink-0 text-xs font-semibold text-muted tabular-nums"
							>{idx + 1}</span
						>

						<!-- Info -->
						<a
							href="/climb/{item.climb.uuid}{angleSearch}"
							class="min-w-0 flex-1"
						>
							<div class="truncate text-sm font-semibold text-text">{item.climb.name}</div>
							<div class="mt-0.5 flex items-center gap-2 text-xs text-muted">
								<span>{grade(item)}</span>
								{#if item.activeStats}
									<span>★ {item.activeStats.quality_average.toFixed(1)}</span>
									<span>{item.activeStats.ascent_count.toLocaleString()} sends</span>
								{/if}
							</div>
						</a>

						<!-- Remove button -->
						<button
							onclick={() => removeClimb(item.climb.uuid)}
							disabled={removingUuid === item.climb.uuid}
							class="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-red-500/10 hover:text-red-400 disabled:opacity-50"
							title="Remove from playlist"
						>
							{#if removingUuid === item.climb.uuid}
								<svg
									class="size-4 animate-spin"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
								>
									<circle cx="12" cy="12" r="10" class="opacity-25" />
									<path class="opacity-75" d="M4 12a8 8 0 018-8V0" />
								</svg>
							{:else}
								<svg
									class="size-4"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
								>
									<path d="M18 6L6 18M6 6l12 12" />
								</svg>
							{/if}
						</button>
					</div>
				{/each}
			</div>

			<!-- Session start button -->
			{#if climbs.length > 0}
				<div class="mt-6">
					<a
						href="/climb/{climbs[0].climb.uuid}{angleSearch}"
						class="flex w-full items-center justify-center gap-2 rounded-2xl border border-border bg-surface-raised py-3.5 text-sm font-semibold text-text transition hover:border-text"
					>
						<svg
							class="size-4"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
						>
							<polygon points="5 3 19 12 5 21 5 3" />
						</svg>
						Start session ({climbs.length} climbs)
					</a>
				</div>
			{/if}
		{/if}
	</div>
</div>
