<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { difficultyToGrade, formatGrade, ROLE, ROLE_COLORS, ROLE_LABELS } from '$lib/data/types';
	import type { ClimbWithStats } from '$lib/data/types';
	import { getClimb } from '$lib/data/repository';
	import { resultsStore } from '$lib/results-store.svelte';
	import { settings } from '$lib/settings-store.svelte';
	import { searchStore } from '$lib/search-store.svelte';
	import { connector } from '$lib/connector.svelte';
	import { resolveHolds } from '$lib/data/repository';
	import {
		getEntry,
		setTicked,
		incrementAttempts,
		resetAttempts,
		setLiked,
		recordLitUp
	} from '$lib/data/log-service';
	import BoardVisualisation from '$lib/components/BoardVisualisation.svelte';
	import TopBar from '$lib/components/TopBar.svelte';

	// ── Route param ───────────────────────────────────────────────────────────
	const uuid = $derived(page.params.uuid);

	let { data } = $props();

	// ── Sync angle from URL / page data into the store ────────────────────────
	$effect(() => {
		const angleFromUrl = data.angle;
		if (angleFromUrl !== null && angleFromUrl !== searchStore.angle) {
			searchStore.angle = angleFromUrl;
		}
	});

	// ── Angle param string for navigation links ────────────────────────────────
	const angleParam = $derived(data.angle !== null ? `?angle=${data.angle}` : '');

	// ── Resolve the item: from load data (direct URL / hard reload) or store ──
	// Null initial value avoids state_referenced_locally warning; populated
	// immediately by the $effect below.
	let item = $state<ClimbWithStats | null>(null);

	$effect(() => {
		const currentUuid = page.params.uuid;
		// Try the in-memory results list first (client-side navigation)
		const fromStore = resultsStore.list.find((r) => r.climb.uuid === currentUuid) ?? null;
		if (fromStore) {
			item = fromStore;
		} else if (data.item && data.item.climb.uuid === currentUuid) {
			// Use the angle-aware item from the load function
			item = data.item;
		} else {
			// Last resort: fetch from repository with angle
			getClimb(currentUuid, data.angle).then((r) => {
				item = r;
			});
		}
	});

	// ── Derived display values ─────────────────────────────────────────────────
	const grade = $derived(
		item?.activeStats
			? formatGrade(difficultyToGrade(item.activeStats.difficulty_average), settings.gradingSystem)
			: '?'
	);

	const qualityFilled = $derived(
		item?.activeStats ? Math.round(item.activeStats.quality_average) : 0
	);

	// ── Prev / Next navigation ─────────────────────────────────────────────────
	const currentUuidDerived = $derived(page.params.uuid);
	const prevItem = $derived(resultsStore.prev(currentUuidDerived));
	const nextItem = $derived(resultsStore.next(currentUuidDerived));
	const listIndex = $derived(resultsStore.indexOf(currentUuidDerived));
	const listTotal = $derived(resultsStore.list.length);

	function goTo(target: ClimbWithStats) {
		goto(`/climb/${target.climb.uuid}${angleParam}`, { replaceState: true });
	}

	function goBack() {
		goto(`/${angleParam ? angleParam : ''}`);
	}

	// ── Touch swipe ───────────────────────────────────────────────────────────
	let touchStartX = 0;
	let touchStartY = 0;

	function onTouchStart(e: TouchEvent) {
		touchStartX = e.touches[0].clientX;
		touchStartY = e.touches[0].clientY;
	}

	function onTouchEnd(e: TouchEvent) {
		const dx = e.changedTouches[0].clientX - touchStartX;
		const dy = e.changedTouches[0].clientY - touchStartY;
		// Only trigger swipe if horizontal movement dominates (not a scroll)
		if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy)) return;
		if (dx < 0 && nextItem) {
			goTo(nextItem);
		} else if (dx > 0 && prevItem) {
			goTo(prevItem);
		}
	}

	// ── User log ──────────────────────────────────────────────────────────────
	let logSnapshot = $state(getEntry(''));

	$effect(() => {
		logSnapshot = getEntry(page.params.uuid);
	});

	function refreshLog() {
		logSnapshot = getEntry(page.params.uuid);
	}

	function toggleTick() {
		setTicked(page.params.uuid, !logSnapshot.ticked);
		refreshLog();
	}

	// Attempt: tap = +1, long-press = reset
	let attemptPressTimer: ReturnType<typeof setTimeout> | null = null;

	function onAttemptPointerDown() {
		attemptPressTimer = setTimeout(() => {
			attemptPressTimer = null;
			resetAttempts(page.params.uuid);
			refreshLog();
		}, 600);
	}

	function onAttemptPointerUp() {
		if (attemptPressTimer !== null) {
			clearTimeout(attemptPressTimer);
			attemptPressTimer = null;
			incrementAttempts(page.params.uuid);
			refreshLog();
		}
	}

	function onAttemptPointerLeave() {
		if (attemptPressTimer !== null) {
			clearTimeout(attemptPressTimer);
			attemptPressTimer = null;
		}
	}

	function toggleLike() {
		setLiked(page.params.uuid, !logSnapshot.liked);
		refreshLog();
	}

	// ── BLE ───────────────────────────────────────────────────────────────────
	let lighting = $state(false);
	let lightError = $state<string | null>(null);

	async function lightUp() {
		if (lighting || !item) return;
		lighting = true;
		lightError = null;
		try {
			// Connect first if not already connected
			if (!connector.isConnected) {
				await connector.connect();
				// User may have cancelled the picker
				if (!connector.isConnected) return;
			}
			const holds = await resolveHolds(item.climb);
			await connector.lightUpClimb(holds);
			recordLitUp(item.climb.uuid);
			refreshLog();
		} catch (err) {
			lightError = err instanceof Error ? err.message : 'Failed to send to board.';
		} finally {
			lighting = false;
		}
	}
</script>

<svelte:head>
	<title>{item?.climb.name ?? 'Climb'} — Kilterboard</title>
</svelte:head>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
	class="min-h-screen bg-bg text-text"
	role="main"
	ontouchstart={onTouchStart}
	ontouchend={onTouchEnd}
>
	<!-- Top bar -->
	<TopBar />

	{#if !item}
		<!-- Loading skeleton -->
		<div class="mx-auto max-w-2xl space-y-4 px-4 py-8">
			<div class="h-4 w-16 animate-pulse rounded-xl bg-surface"></div>
			<div class="h-8 w-2/3 animate-pulse rounded-xl bg-surface"></div>
			<div class="h-4 w-1/3 animate-pulse rounded-xl bg-surface"></div>
			<div class="h-32 animate-pulse rounded-2xl bg-surface"></div>
		</div>
	{:else}
		{@const climb = item.climb}
		{@const activeStats = item.activeStats}

		<div class="mx-auto max-w-2xl px-4 py-4">
			<!-- Nav row: back link + prev/next -->
			<div class="flex items-center justify-between">
				<button
					onclick={goBack}
					class="inline-flex items-center gap-1.5 text-sm text-muted transition hover:text-text"
				>
					<svg
						class="size-4"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
					>
						<path d="M19 12H5M12 5l-7 7 7 7" />
					</svg>
					Back
				</button>

				<div class="flex items-center gap-2">
					{#if listTotal > 0 && listIndex !== -1}
						<span class="text-xs text-muted">{listIndex + 1} of {listTotal}</span>
					{/if}
					<button
						onclick={() => prevItem && goTo(prevItem)}
						disabled={!prevItem}
						aria-label="Previous climb"
						class="flex items-center gap-1.5 rounded-xl border border-border bg-surface-raised px-3 py-2 text-sm font-semibold text-muted transition hover:text-text disabled:cursor-not-allowed disabled:opacity-30"
					>
						<svg
							class="size-5"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
						>
							<path d="M15 18l-6-6 6-6" />
						</svg>
						Prev
					</button>
					<button
						onclick={() => nextItem && goTo(nextItem)}
						disabled={!nextItem}
						aria-label="Next climb"
						class="flex items-center gap-1.5 rounded-xl border border-border bg-surface-raised px-3 py-2 text-sm font-semibold text-muted transition hover:text-text disabled:cursor-not-allowed disabled:opacity-30"
					>
						Next
						<svg
							class="size-5"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
						>
							<path d="M9 18l6-6-6-6" />
						</svg>
					</button>
				</div>
			</div>

			<!-- Name + grade -->
			<div class="mt-4 flex items-start justify-between gap-4">
				<div class="min-w-0 flex-1">
					<h1 class="text-2xl leading-tight font-bold text-text">{climb.name}</h1>
					<p class="mt-1 text-sm text-muted">by {climb.setter_username}</p>
				</div>
				<span
					class="shrink-0 rounded-xl border border-border bg-surface-raised px-3 py-1 text-lg font-bold text-text"
				>
					{grade}
				</span>
			</div>

			<!-- Stats + tags -->
			{#if activeStats}
				<div class="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted">
					<!-- Quality -->
					<div class="flex items-center gap-1">
						{#each [1, 2, 3] as star}
							<svg
								class="size-4 {star <= qualityFilled ? 'text-yellow-400' : 'text-border'}"
								xmlns="http://www.w3.org/2000/svg"
								viewBox="0 0 24 24"
								fill="currentColor"
							>
								<path
									d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
								/>
							</svg>
						{/each}
						<span class="ml-1">{activeStats.quality_average.toFixed(1)}</span>
					</div>
					<!-- Ascents -->
					{#if activeStats.ascent_count > 0}
						<div class="flex items-center gap-1.5">
							<svg
								class="size-4 text-muted"
								xmlns="http://www.w3.org/2000/svg"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
							>
								<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
								<circle cx="9" cy="7" r="4" />
								<path d="M23 21v-2a4 4 0 0 0-3-3.87" />
								<path d="M16 3.13a4 4 0 0 1 0 7.75" />
							</svg>
							<span>{activeStats.ascent_count.toLocaleString()} ascents</span>
						</div>
					{/if}
					<!-- Tag pills -->
					{#if activeStats?.benchmark_difficulty != null}
						<span
							class="rounded-md bg-yellow-500/10 px-2 py-0.5 text-[11px] font-semibold text-yellow-400"
							>Benchmark</span
						>
					{/if}
					{#if climb.is_campus}
						<span
							class="rounded-md bg-purple-500/10 px-2 py-0.5 text-[11px] font-semibold text-purple-400"
							>Campus</span
						>
					{/if}
					{#if climb.is_route}
						<span
							class="rounded-md bg-blue-500/10 px-2 py-0.5 text-[11px] font-semibold text-blue-400"
							>Route</span
						>
					{/if}
					{#if !climb.allow_matches}
						<span class="rounded-md bg-muted/20 px-2 py-0.5 text-[11px] font-semibold text-muted"
							>No matching</span
						>
					{/if}
				</div>
			{/if}

			<!-- Description -->
			{#if climb.description}
				<p class="mt-6 text-sm leading-relaxed text-muted">{climb.description}</p>
			{/if}

			<!-- Action buttons -->
			<div class="mt-4 flex flex-col gap-3">
				<!-- Row 1: Tick / Try / Like — equal width -->
				<div class="flex items-center gap-3">
					<!-- Tick -->
					<button
						onclick={toggleTick}
						title={logSnapshot.ticked ? 'Remove tick' : 'Mark as ticked'}
						class="flex flex-1 items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition active:scale-95 {logSnapshot.ticked
							? 'border-green-600 bg-green-600/10 text-green-400'
							: 'border-border bg-surface-raised text-muted hover:text-text'}"
					>
						<svg
							class="size-4"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2.5"
						>
							<path d="M5 13l4 4L19 7" />
						</svg>
						{logSnapshot.ticked ? 'Ticked' : 'Tick'}
					</button>

					<!-- Attempt: tap = +1, long-press = reset -->
					<button
						onpointerdown={onAttemptPointerDown}
						onpointerup={onAttemptPointerUp}
						onpointerleave={onAttemptPointerLeave}
						title="Tap to log attempt · Hold to reset"
						class="relative flex flex-1 items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition select-none active:scale-95 {logSnapshot.attemptCount >
						0
							? 'border-amber-600 bg-amber-600/10 text-amber-400'
							: 'border-border bg-surface-raised text-muted hover:text-text'}"
					>
						<svg
							class="size-4"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
						>
							<path d="M12 5v14M5 12l7-7 7 7" />
						</svg>
						{#if logSnapshot.attemptCount > 0}
							{logSnapshot.attemptCount}×
						{:else}
							Try
						{/if}
						{#if logSnapshot.attemptCount > 0}
							<span
								class="absolute -top-1.5 -right-1.5 flex size-4 items-center justify-center rounded-full bg-amber-500 text-[10px] leading-none font-bold text-white"
							>
								{logSnapshot.attemptCount > 99 ? '99+' : logSnapshot.attemptCount}
							</span>
						{/if}
					</button>

					<!-- Like -->
					<button
						onclick={toggleLike}
						title={logSnapshot.liked ? 'Unlike' : 'Like'}
						class="flex flex-1 items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition active:scale-95 {logSnapshot.liked
							? 'border-pink-600 bg-pink-600/10 text-pink-400'
							: 'border-border bg-surface-raised text-muted hover:text-text'}"
					>
						<svg
							class="size-4"
							viewBox="0 0 24 24"
							fill={logSnapshot.liked ? 'currentColor' : 'none'}
							stroke="currentColor"
							stroke-width="2"
						>
							<path
								d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"
							/>
						</svg>
						{logSnapshot.liked ? 'Liked' : 'Like'}
					</button>
				</div>

				<!-- Row 2: Light Up — full width -->
				<button
					onclick={lightUp}
					disabled={lighting}
					class="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-surface-raised px-4 py-2.5 text-sm font-semibold text-text transition hover:border-cyan-600 hover:bg-cyan-600/10 hover:text-cyan-300 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
				>
					{#if lighting}
						<svg
							class="size-4 animate-spin"
							xmlns="http://www.w3.org/2000/svg"
							fill="none"
							viewBox="0 0 24 24"
						>
							<circle
								class="opacity-25"
								cx="12"
								cy="12"
								r="10"
								stroke="currentColor"
								stroke-width="4"
							></circle>
							<path
								class="opacity-75"
								fill="currentColor"
								d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
							></path>
						</svg>
						Sending…
					{:else}
						<svg
							class="size-4"
							xmlns="http://www.w3.org/2000/svg"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
						>
							<path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
						</svg>
						Light Up
					{/if}
				</button>
			</div>

			{#if lightError}
				<p class="mt-3 text-sm text-red-400">{lightError}</p>
			{/if}

			<!-- Board visualisation -->
			<div class="mt-4">
				<h2 class="mb-2 text-xs font-semibold tracking-wider text-muted uppercase">Board Map</h2>
				<BoardVisualisation frames={climb.frames} />
			</div>

			<!-- Hold colour legend -->
			<div class="mt-4 space-y-3 rounded-2xl border border-border bg-surface p-4">
				<h2 class="text-xs font-semibold tracking-wider text-muted uppercase">Hold Legend</h2>
				<div class="flex flex-wrap gap-3">
					{#each Object.entries(ROLE_LABELS) as [roleIdStr, label]}
						{@const roleId = Number(roleIdStr)}
						{@const color = ROLE_COLORS[roleId as keyof typeof ROLE_COLORS]}
						<div class="flex items-center gap-2">
							<span class="inline-block size-3 rounded-full" style="background-color: {color.hex}"
							></span>
							<span class="text-xs text-muted">{label}</span>
						</div>
					{/each}
				</div>
			</div>

			<!-- All angle stats -->
			{#if item.stats.length > 1}
				<div class="mt-4 space-y-3 rounded-2xl border border-border bg-surface p-4">
					<h2 class="text-xs font-semibold tracking-wider text-muted uppercase">Stats by angle</h2>
					<div class="space-y-2">
						{#each item.stats as s}
							<div class="flex items-center justify-between text-sm">
								<span class="text-muted">{s.angle}°</span>
								<div class="flex items-center gap-4 text-xs text-muted">
									<span
										>{formatGrade(
											difficultyToGrade(s.difficulty_average),
											settings.gradingSystem
										)}</span
									>
									<span>★ {s.quality_average.toFixed(1)}</span>
									<span>{s.ascent_count.toLocaleString()} sends</span>
								</div>
							</div>
						{/each}
					</div>
				</div>
			{/if}
		</div>
	{/if}
</div>
