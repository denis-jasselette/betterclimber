<script lang="ts">
	import { untrack } from 'svelte'
	import TopBar from '$lib/components/TopBar.svelte'

	let { data } = $props()

	const template = $derived(data.template)

	// Track which blocks are expanded (all open by default).
	// untrack() prevents reactivity tracking of data during initialization —
	// expandedBlocks is interactive state; user can collapse/expand blocks independently.
	// eslint-disable-next-line svelte/prefer-writable-derived
	let expandedBlocks = $state<Set<string>>(
		untrack(() => new Set(data.template.blocks.map((b) => b.id)))
	)

	function toggleBlock(id: string) {
		const next = new Set(expandedBlocks)
		if (next.has(id)) {
			next.delete(id)
		} else {
			next.add(id)
		}
		expandedBlocks = next
	}

	/** Format exercise duration/reps into a human-readable summary line. */
	function exerciseSummary(ex: (typeof template.blocks)[number]['exercises'][number]): string {
		const parts: string[] = []

		if (ex.series_count > 1) {
			parts.push(`${ex.series_count} series`)
		}

		if (ex.type === 'reps' && ex.reps != null) {
			parts.push(`${ex.reps} rep${ex.reps !== 1 ? 's' : ''}`)
		} else if (ex.type === 'timed' && ex.duration_s != null) {
			parts.push(formatSeconds(ex.duration_s))
		} else if (ex.type === 'climb') {
			if (ex.climb_count != null) {
				parts.push(`${ex.climb_count} climb${ex.climb_count !== 1 ? 's' : ''}`)
			}
			if (ex.duration_per_climb_s != null) {
				parts.push(`${formatSeconds(ex.duration_per_climb_s)}/climb`)
			}
		}

		if (ex.rest_s > 0) {
			parts.push(`${ex.rest_s}s rest`)
		}

		return parts.join(' · ')
	}

	function formatSeconds(s: number): string {
		if (s < 60) return `${s}s`
		const m = Math.floor(s / 60)
		const remaining = s % 60
		return remaining > 0 ? `${m}m ${remaining}s` : `${m}m`
	}

	/** Icon path for exercise type. */
	function typeIcon(type: string): string {
		if (type === 'timed') {
			return `<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3" stroke-linecap="round" stroke-linejoin="round"/>`
		}
		if (type === 'climb') {
			return `<path d="M12 2C8.686 2 6 4.686 6 8c0 5.25 6 12 6 12s6-6.75 6-12c0-3.314-2.686-6-6-6z" stroke-linecap="round"/><circle cx="12" cy="8" r="2"/>`
		}
		// reps (default)
		return `<path d="M6 5h12M6 12h12M6 19h12" stroke-linecap="round"/>`
	}

	/** Badge colour per type. */
	function typeBadgeClass(type: string): string {
		if (type === 'timed') return 'bg-amber-400/10 text-amber-400'
		if (type === 'climb') return 'bg-cyan-500/10 text-cyan-400'
		return 'bg-violet-500/10 text-violet-400'
	}
</script>

<svelte:head>
	<title>{template.name} — Session Library — BetterClimber</title>
</svelte:head>

<div class="min-h-screen bg-bg text-text">
	<TopBar hideBoardControls />

	<main class="mx-auto max-w-2xl px-4 py-8">
		<!-- Header -->
		<div class="mb-8 flex items-start gap-3">
			<a
				href="/sessions"
				aria-label="Back to session library"
				class="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl border border-border bg-surface text-muted transition hover:text-text"
			>
				<svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M19 12H5M12 19l-7-7 7-7" stroke-linecap="round" stroke-linejoin="round" />
				</svg>
			</a>

			<div class="min-w-0 flex-1">
				<h1 class="text-2xl font-bold text-text">{template.name}</h1>
				{#if template.description}
					<p class="mt-1 text-sm text-muted">{template.description}</p>
				{/if}
				<p class="mt-2 text-xs text-muted">
					{template.blocks.length}
					{template.blocks.length === 1 ? 'block' : 'blocks'}
				</p>
			</div>
		</div>

		<!-- Blocks -->
		{#if template.blocks.length === 0}
			<div class="rounded-2xl border border-border bg-surface p-8 text-center">
				<p class="text-sm text-muted">This template has no blocks yet.</p>
			</div>
		{:else}
			<div class="space-y-3">
				{#each template.blocks as block, blockIdx (block.id)}
					<div class="rounded-2xl border border-border bg-surface">
						<!-- Block header (toggle) -->
						<button
							onclick={() => toggleBlock(block.id)}
							class="flex w-full items-center gap-3 px-5 py-4 text-left"
							aria-expanded={expandedBlocks.has(block.id)}
						>
							<!-- Position badge -->
							<span
								class="flex size-7 shrink-0 items-center justify-center rounded-lg bg-surface-raised text-xs font-bold text-muted"
							>
								{blockIdx + 1}
							</span>

							<div class="min-w-0 flex-1">
								<p class="font-semibold text-text">{block.name}</p>
								{#if block.description}
									<p class="mt-0.5 line-clamp-1 text-xs text-muted">{block.description}</p>
								{/if}
							</div>

							<div class="flex items-center gap-2 shrink-0">
								<span class="text-xs text-muted">
									{block.exercises.length}
									{block.exercises.length === 1 ? 'exercise' : 'exercises'}
								</span>
								<!-- Chevron -->
								<svg
									class="size-4 text-muted transition-transform duration-200 {expandedBlocks.has(block.id)
										? 'rotate-180'
										: ''}"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
								>
									<path d="M6 9l6 6 6-6" stroke-linecap="round" stroke-linejoin="round" />
								</svg>
							</div>
						</button>

						<!-- Exercise list -->
						{#if expandedBlocks.has(block.id) && block.exercises.length > 0}
							<ul class="border-t border-border">
								{#each block.exercises as exercise, exIdx (exercise.id)}
									<li
										class="flex items-start gap-4 px-5 py-4 {exIdx < block.exercises.length - 1
											? 'border-b border-border/50'
											: ''}"
									>
										<!-- Type icon -->
										<div
											class="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg {typeBadgeClass(exercise.type)}"
										>
											<svg
												class="size-4"
												viewBox="0 0 24 24"
												fill="none"
												stroke="currentColor"
												stroke-width="1.75"
											>
												{@html typeIcon(exercise.type)}
											</svg>
										</div>

										<div class="min-w-0 flex-1">
											<div class="flex flex-wrap items-center gap-2">
												<p class="font-medium text-text">{exercise.name}</p>
												<span
													class="rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide {typeBadgeClass(exercise.type)}"
												>
													{exercise.type}
												</span>
											</div>

											{#if exercise.description}
												<p class="mt-1 text-sm text-muted">{exercise.description}</p>
											{/if}

											<!-- Climb grade reference label -->
											{#if exercise.type === 'climb' && exercise.grade_ref}
												<p class="mt-1 text-xs font-medium text-cyan-400">
													{exercise.grade_ref}
												</p>
											{/if}

											<!-- Summary line -->
											{#if exerciseSummary(exercise)}
												<p class="mt-1 text-xs text-muted">{exerciseSummary(exercise)}</p>
											{/if}
										</div>
									</li>
								{/each}
							</ul>
						{:else if expandedBlocks.has(block.id)}
							<p class="border-t border-border px-5 py-4 text-sm text-muted">No exercises in this block.</p>
						{/if}
					</div>
				{/each}
			</div>
		{/if}

		<!-- Actions -->
		<div class="mt-8 space-y-3">
			<!-- Start session (placeholder — wired up in next issue) -->
			<a
				href="/sessions/{template.id}/start"
				class="flex w-full items-center justify-center gap-2 rounded-2xl border border-cyan-600/50 bg-cyan-600/10 py-3.5 text-sm font-semibold text-cyan-400 transition hover:bg-cyan-600/20 active:scale-[0.99]"
			>
				<svg
					class="size-4"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
				>
					<polygon points="5 3 19 12 5 21 5 3" fill="currentColor" stroke="none" />
				</svg>
				Start session
			</a>

			<!-- History link (wired up in log issue) -->
			<a
				href="/sessions/history"
				class="flex w-full items-center justify-center gap-2 rounded-2xl border border-border bg-surface py-3 text-sm font-medium text-muted transition hover:border-border hover:text-text"
			>
				<svg
					class="size-4"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="1.75"
				>
					<path d="M12 8v4l3 3" stroke-linecap="round" stroke-linejoin="round" />
					<path d="M3.05 11a9 9 0 1 0 .5-3M3 4v4h4" stroke-linecap="round" stroke-linejoin="round" />
				</svg>
				Session history
			</a>
		</div>
	</main>
</div>
