<script lang="ts">
	import { page } from '$app/state'
	import TopBar from '$lib/components/TopBar.svelte'

	// ── Types ──────────────────────────────────────────────────────────────────

	type Exercise = {
		id: string
		name: string
		description: string | null
		type: string
		series_count: number
		rest_s: number
		// reps
		reps: number | null
		// timed
		duration_s: number | null
		// climb
		grade_ref: string | null
		climb_count: number | null
		duration_per_climb_s: number | null
		rest_between_climbs_s: number | null
	}

	type Block = {
		id: string
		name: string
		description: string | null
		position: number
		exercises: Exercise[]
	}

	type Template = {
		id: string
		name: string
		description: string | null
		blocks: Block[]
	}

	// ── State ─────────────────────────────────────────────────────────────────

	let template = $state<Template | null>(null)
	let loading = $state(true)
	let error = $state<string | null>(null)
	let expandedBlocks = $state<Set<string>>(new Set())

	// ── Load ──────────────────────────────────────────────────────────────────

	async function loadTemplate(id: string) {
		loading = true
		error = null
		try {
			const res = await fetch(`/api/sessions/${id}`)
			if (res.status === 404) {
				error = 'Template not found'
				return
			}
			if (!res.ok) throw new Error('Failed to load session template')
			const data: Template = await res.json()
			template = data
			// Expand all blocks by default
			expandedBlocks = new Set(data.blocks.map((b) => b.id))
		} catch (e) {
			error = e instanceof Error ? e.message : 'Unknown error'
		} finally {
			loading = false
		}
	}

	$effect(() => {
		const id = page.params.id
		if (id) loadTemplate(id)
	})

	// ── Helpers ───────────────────────────────────────────────────────────────

	function toggleBlock(id: string) {
		const next = new Set(expandedBlocks)
		if (next.has(id)) {
			next.delete(id)
		} else {
			next.add(id)
		}
		expandedBlocks = next
	}

	/** Format seconds as "Xm Ys" or just "Ys" */
	function formatDuration(s: number): string {
		if (s < 60) return `${s}s`
		const m = Math.floor(s / 60)
		const rem = s % 60
		return rem > 0 ? `${m}m ${rem}s` : `${m}m`
	}

	/** Build the exercise detail line based on type */
	function exerciseDetail(ex: Exercise): string {
		if (ex.type === 'reps' && ex.reps != null) {
			return `${ex.series_count} × ${ex.reps} reps`
		}
		if (ex.type === 'timed' && ex.duration_s != null) {
			return `${ex.series_count} × ${formatDuration(ex.duration_s)}`
		}
		if (ex.type === 'climb') {
			const count = ex.climb_count ?? 1
			const series = ex.series_count
			return series > 1
				? `${series} sets · ${count} climb${count !== 1 ? 's' : ''} each`
				: `${count} climb${count !== 1 ? 's' : ''}`
		}
		return ''
	}

	function totalBlocks(t: Template): number {
		return t.blocks.length
	}

	function totalExercises(t: Template): number {
		return t.blocks.reduce((sum, b) => sum + b.exercises.length, 0)
	}
</script>

<svelte:head>
	<title>{template?.name ?? 'Session'} — BetterClimber</title>
</svelte:head>

<div class="min-h-screen bg-bg">
	<TopBar hideBoardControls />

	<main class="mx-auto max-w-2xl px-4 py-8">
		<!-- Back link -->
		<a
			href="/sessions"
			class="mb-6 inline-flex items-center gap-1.5 text-sm text-muted transition hover:text-text"
		>
			<svg
				class="size-4"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
			>
				<polyline points="15 18 9 12 15 6" />
			</svg>
			Session Library
		</a>

		<!-- Loading skeleton -->
		{#if loading}
			<div class="space-y-4">
				<div class="h-8 w-48 animate-pulse rounded-lg bg-surface"></div>
				<div class="h-4 w-72 animate-pulse rounded-lg bg-surface"></div>
				<div class="mt-6 space-y-3">
					{#each [1, 2, 3] as i (i)}
						<div class="h-16 animate-pulse rounded-2xl border border-border bg-surface"></div>
					{/each}
				</div>
			</div>

		<!-- Error -->
		{:else if error}
			<div class="rounded-2xl border border-red-500/30 bg-red-500/5 p-6 text-center">
				<p class="text-sm text-red-400">{error}</p>
				<a href="/sessions" class="mt-3 inline-block text-xs text-muted underline">
					Back to library
				</a>
			</div>

		<!-- Template detail -->
		{:else if template}
			<!-- Header -->
			<div class="mb-6">
				<h1 class="text-2xl font-bold text-text">{template.name}</h1>
				{#if template.description}
					<p class="mt-2 text-sm text-muted">{template.description}</p>
				{/if}
				<div class="mt-3 flex flex-wrap gap-3">
					<span
						class="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1 text-xs text-muted"
					>
						<svg
							class="size-3.5"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
						>
							<rect x="3" y="4" width="18" height="18" rx="2" />
							<path d="M16 2v4M8 2v4M3 10h18" />
						</svg>
						{totalBlocks(template)} {totalBlocks(template) === 1 ? 'block' : 'blocks'}
					</span>
					<span
						class="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1 text-xs text-muted"
					>
						<svg
							class="size-3.5"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
						>
							<circle cx="12" cy="12" r="9" />
							<polyline points="12 7 12 12 15 15" />
						</svg>
						{totalExercises(template)} {totalExercises(template) === 1 ? 'exercise' : 'exercises'}
					</span>
				</div>
			</div>

			<!-- Blocks -->
			{#if template.blocks.length === 0}
				<div class="rounded-2xl border border-border bg-surface p-8 text-center">
					<p class="text-sm text-muted">This template has no blocks yet.</p>
				</div>
			{:else}
				<div class="space-y-3">
					{#each template.blocks as block (block.id)}
						<div class="overflow-hidden rounded-2xl border border-border bg-surface">
							<!-- Block header (toggle) -->
							<button
								type="button"
								onclick={() => toggleBlock(block.id)}
								class="flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-surface-raised"
								aria-expanded={expandedBlocks.has(block.id)}
							>
								<!-- Block number badge -->
								<span
									class="flex size-6 shrink-0 items-center justify-center rounded-full bg-cyan-600/15 text-xs font-semibold text-cyan-400"
								>
									{block.position}
								</span>

								<div class="min-w-0 flex-1">
									<p class="font-semibold text-text">{block.name}</p>
									{#if block.description}
										<p class="mt-0.5 text-xs text-muted">{block.description}</p>
									{/if}
								</div>

								<!-- Exercise count + chevron -->
								<div class="flex shrink-0 items-center gap-2">
									<span class="text-xs text-muted">
										{block.exercises.length} {block.exercises.length === 1 ? 'exercise' : 'exercises'}
									</span>
									<svg
										class="size-4 text-muted transition-transform duration-200 {expandedBlocks.has(block.id)
											? 'rotate-180'
											: ''}"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										stroke-width="2"
										stroke-linecap="round"
										stroke-linejoin="round"
									>
										<polyline points="6 9 12 15 18 9" />
									</svg>
								</div>
							</button>

							<!-- Exercises (collapsible) -->
							{#if expandedBlocks.has(block.id)}
								<div class="divide-y divide-border border-t border-border">
									{#if block.exercises.length === 0}
										<p class="px-4 py-3 text-xs text-muted">No exercises in this block.</p>
									{:else}
										{#each block.exercises as ex (ex.id)}
											<div class="flex items-start gap-3 px-4 py-3">
												<!-- Type badge -->
												<span
													class="mt-0.5 shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide
													{ex.type === 'reps'
														? 'bg-green-500/10 text-green-400'
														: ex.type === 'timed'
															? 'bg-blue-500/10 text-blue-400'
															: 'bg-orange-500/10 text-orange-400'}"
												>
													{ex.type === 'climb' ? 'climb' : ex.type}
												</span>

												<div class="min-w-0 flex-1">
													<p class="text-sm font-medium text-text">{ex.name}</p>
													{#if ex.description}
														<p class="mt-0.5 text-xs text-muted">{ex.description}</p>
													{/if}

													<div class="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
														<!-- Series × reps / duration / climbs -->
														<span>{exerciseDetail(ex)}</span>

														<!-- Grade ref (climb type) -->
														{#if ex.type === 'climb' && ex.grade_ref}
															<span class="flex items-center gap-1">
																<svg
																	class="size-3"
																	viewBox="0 0 24 24"
																	fill="none"
																	stroke="currentColor"
																	stroke-width="2"
																	stroke-linecap="round"
																	stroke-linejoin="round"
																>
																	<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
																</svg>
																{ex.grade_ref}
															</span>
														{/if}

														<!-- Rest between sets -->
														{#if ex.rest_s > 0}
															<span>Rest {formatDuration(ex.rest_s)}</span>
														{/if}

														<!-- Rest between climbs (climb type) -->
														{#if ex.type === 'climb' && ex.rest_between_climbs_s && ex.rest_between_climbs_s > 0}
															<span>{formatDuration(ex.rest_between_climbs_s)} between climbs</span>
														{/if}
													</div>
												</div>
											</div>
										{/each}
									{/if}
								</div>
							{/if}
						</div>
					{/each}
				</div>
			{/if}

			<!-- Footer actions -->
			<div class="mt-8 flex flex-wrap gap-3">
				<!-- Start session (placeholder — wired in next issue) -->
				<button
					type="button"
					class="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-cyan-500 active:scale-95"
					onclick={() => alert('Session follow-along coming soon!')}
				>
					<svg
						class="size-4"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2.5"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<polygon points="5 3 19 12 5 21 5 3" fill="currentColor" stroke="none" />
					</svg>
					Start session
				</button>

				<!-- History link (placeholder) -->
				<a
					href="/sessions/history"
					class="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-5 py-2.5 text-sm font-semibold text-muted transition hover:border-border hover:text-text active:scale-95"
				>
					<svg
						class="size-4"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="1.75"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<polyline points="1 4 1 10 7 10" />
						<path d="M3.51 15a9 9 0 1 0 .49-3" />
					</svg>
					History
				</a>
			</div>
		{/if}
	</main>
</div>
