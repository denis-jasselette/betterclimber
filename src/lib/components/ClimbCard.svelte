<script lang="ts">
import type { BoardConnector } from '$lib/ble/board-connector.svelte'
import {
	getEntry,
	incrementAttempts,
	recordLitUp,
	resetAttempts,
	setLiked,
	setTicked
} from '$lib/data/log-service'
import { resolveHolds } from '$lib/data/repository'
import type { ClimbWithStats } from '$lib/data/types'
import { difficultyToGrade, formatGrade } from '$lib/data/types'
import { searchStore } from '$lib/search-store.svelte'
import { settings } from '$lib/settings-store.svelte'

let {
	item,
	connector,
	href
}: {
	item: ClimbWithStats
	connector: BoardConnector
	href?: string
} = $props()

const { climb, activeStats } = $derived(item)

const grade = $derived(
	activeStats
		? formatGrade(difficultyToGrade(activeStats.difficulty_average), settings.gradingSystem)
		: '?'
)

// Quality display (1–3 stars)
const qualityFilled = $derived(activeStats ? Math.round(activeStats.quality_average) : 0)

// User log state — re-derived whenever the climb uuid changes, re-read after mutations.
// logOverride is null until a local mutation fires; once set it takes precedence over the
// derived value until the next uuid change, avoiding the state_referenced_locally warning.
let logOverride = $state<ReturnType<typeof getEntry> | null>(null)
let logDerived = $derived(getEntry(item.climb.uuid, searchStore.angle))
// Reset override when the climb changes
$effect(() => {
	// eslint-disable-next-line @typescript-eslint/no-unused-expressions
	item.climb.uuid // track
	logOverride = null
})
const logSnapshot = $derived(logOverride ?? logDerived)

function refreshLog() {
	logOverride = getEntry(item.climb.uuid, searchStore.angle)
}

function toggleTick() {
	setTicked(item.climb.uuid, searchStore.angle, !logSnapshot.ticked)
	refreshLog()
}

// Attempt: tap = increment, long-press = reset to 0
let attemptPressTimer: ReturnType<typeof setTimeout> | null = null

function onAttemptPointerDown() {
	attemptPressTimer = setTimeout(() => {
		attemptPressTimer = null
		resetAttempts(item.climb.uuid, searchStore.angle)
		refreshLog()
	}, 600)
}

function onAttemptPointerUp() {
	if (attemptPressTimer !== null) {
		clearTimeout(attemptPressTimer)
		attemptPressTimer = null
		incrementAttempts(item.climb.uuid, searchStore.angle)
		refreshLog()
	}
}

function onAttemptPointerLeave() {
	if (attemptPressTimer !== null) {
		clearTimeout(attemptPressTimer)
		attemptPressTimer = null
	}
}

function toggleLike() {
	setLiked(item.climb.uuid, searchStore.angle, !logSnapshot.liked)
	refreshLog()
}

// BLE state
let lighting = $state(false)
let lightError = $state<string | null>(null)

async function lightUp() {
	if (lighting) return
	lighting = true
	lightError = null
	try {
		// Connect first if not already connected
		if (!connector.isConnected) {
			await connector.connect()
			// User may have cancelled the picker
			if (!connector.isConnected) return
		}
		const holds = await resolveHolds(climb)
		await connector.lightUpClimb(holds)
		recordLitUp(climb.uuid, searchStore.angle)
		refreshLog()
	} catch (err) {
		lightError = err instanceof Error ? err.message : 'Failed to send to board.'
	} finally {
		lighting = false
	}
}
</script>

<article
	class="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4 transition hover:border-border"
>
	<!-- Header row -->
	<div class="flex items-start justify-between gap-3">
		<div class="min-w-0 flex-1">
			{#if href}
				<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
				<a {href} class="group block">
					<h2 class="truncate font-semibold text-text transition-colors group-hover:text-cyan-300">
						{climb.name}
					</h2>
					<p class="mt-0.5 text-xs text-muted">by {climb.setter_username}</p>
				</a>
			{:else}
				<h2 class="truncate font-semibold text-text">{climb.name}</h2>
				<p class="mt-0.5 text-xs text-muted">by {climb.setter_username}</p>
			{/if}
		</div>

		<!-- Grade badge -->
		<span
			class="shrink-0 rounded-lg border border-border bg-surface-raised px-2.5 py-0.5 text-sm font-bold text-text"
		>
			{grade}
		</span>
	</div>

	<!-- Stats row -->
	<div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
		<!-- Quality stars -->
		{#if activeStats}
			<div class="flex items-center gap-0.5">
				{#each [1, 2, 3] as star (star)}
					<svg
						class="size-3 {star <= qualityFilled ? 'text-yellow-400' : 'text-border'}"
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
		{/if}

		<!-- Ascent count -->
		{#if activeStats && activeStats.ascent_count > 0}
			<div class="flex items-center gap-1">
				<svg
					class="size-3.5 text-muted"
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
				<span>{activeStats.ascent_count.toLocaleString()}</span>
			</div>
		{/if}

		<!-- Tag pills -->
		{#if activeStats?.benchmark_difficulty !== null && activeStats?.benchmark_difficulty !== undefined}
			<span
				class="rounded-md bg-yellow-500/10 px-2 py-0.5 text-[11px] font-semibold text-yellow-400"
			>
				Benchmark
			</span>
		{/if}
		{#if climb.is_campus}
			<span
				class="rounded-md bg-purple-500/10 px-2 py-0.5 text-[11px] font-semibold text-purple-400"
			>
				Campus
			</span>
		{/if}
		{#if climb.is_route}
			<span class="rounded-md bg-blue-500/10 px-2 py-0.5 text-[11px] font-semibold text-blue-400">
				Route
			</span>
		{/if}
		{#if !climb.allow_matches}
			<span class="rounded-md bg-muted/20 px-2 py-0.5 text-[11px] font-semibold text-muted">
				No matching
			</span>
		{/if}
	</div>

	<!-- Action row: user log + Light Up -->
	<div class="mt-1 flex items-center gap-2">
		<!-- Tick -->
		<button
			onclick={toggleTick}
			title={logSnapshot.ticked ? 'Remove tick' : 'Mark as ticked'}
			class="flex items-center gap-1 rounded-xl border px-2.5 py-2 text-xs font-semibold transition active:scale-95 {logSnapshot.ticked
				? 'border-green-600 bg-green-600/10 text-green-400'
				: 'border-border bg-surface-raised text-muted hover:border-border hover:text-text'}"
		>
			<svg
				class="size-3.5"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2.5"
			>
				<path d="M5 13l4 4L19 7" />
			</svg>
		</button>

		<!-- Attempt: tap = +1, long-press = reset -->
		<button
			onpointerdown={onAttemptPointerDown}
			onpointerup={onAttemptPointerUp}
			onpointerleave={onAttemptPointerLeave}
			title="Tap to log attempt · Hold to reset"
			class="relative flex items-center gap-1 rounded-xl border px-2.5 py-2 text-xs font-semibold transition select-none active:scale-95 {logSnapshot.attemptCount >
			0
				? 'border-amber-600 bg-amber-600/10 text-amber-400'
				: 'border-border bg-surface-raised text-muted hover:border-border hover:text-text'}"
		>
			<svg class="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<path d="M12 5v14M5 12l7-7 7 7" />
			</svg>
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
			class="flex items-center gap-1 rounded-xl border px-2.5 py-2 text-xs font-semibold transition active:scale-95 {logSnapshot.liked
				? 'border-pink-600 bg-pink-600/10 text-pink-400'
				: 'border-border bg-surface-raised text-muted hover:border-border hover:text-text'}"
		>
			<svg
				class="size-3.5"
				viewBox="0 0 24 24"
				fill={logSnapshot.liked ? 'currentColor' : 'none'}
				stroke="currentColor"
				stroke-width="2"
			>
				<path
					d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"
				/>
			</svg>
		</button>

		<!-- Light Up — fills remaining space -->
		<button
			onclick={lightUp}
			disabled={lighting}
			class="flex flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-surface-raised py-2 text-xs font-semibold text-text transition hover:border-cyan-600 hover:bg-cyan-600/10 hover:text-cyan-300 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
		>
			{#if lighting}
				<svg
					class="size-3.5 animate-spin"
					xmlns="http://www.w3.org/2000/svg"
					fill="none"
					viewBox="0 0 24 24"
				>
					<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"
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
					class="size-3.5"
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
		<p class="text-xs text-red-400">{lightError}</p>
	{/if}
</article>
