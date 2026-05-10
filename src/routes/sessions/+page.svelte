<script lang="ts">
	import TopBar from '$lib/components/TopBar.svelte'

	// ── Types ──────────────────────────────────────────────────────────────────

	type SessionTemplate = {
		id: string
		name: string
		description: string | null
	}

	// ── State ─────────────────────────────────────────────────────────────────

	let templates = $state<SessionTemplate[]>([])
	let loading = $state(true)
	let error = $state<string | null>(null)

	// ── Load ──────────────────────────────────────────────────────────────────

	async function loadTemplates() {
		loading = true
		error = null
		try {
			const res = await fetch('/api/sessions')
			if (!res.ok) throw new Error('Failed to load session templates')
			templates = await res.json()
		} catch (e) {
			error = e instanceof Error ? e.message : 'Unknown error'
		} finally {
			loading = false
		}
	}

	$effect(() => {
		loadTemplates()
	})
</script>

<svelte:head>
	<title>Session Library — BetterClimber</title>
</svelte:head>

<div class="min-h-screen bg-bg">
	<TopBar hideBoardControls />

	<main class="mx-auto max-w-2xl px-4 py-8">
		<div class="mb-6">
			<h1 class="text-2xl font-bold text-text">Session Library</h1>
			<p class="mt-1 text-sm text-muted">Structured training templates for your climbing sessions.</p>
		</div>

		<!-- Loading skeleton -->
		{#if loading}
			<div class="space-y-3">
				{#each [1, 2, 3] as i (i)}
					<div class="h-24 animate-pulse rounded-2xl border border-border bg-surface"></div>
				{/each}
			</div>

		<!-- Error -->
		{:else if error}
			<div class="rounded-2xl border border-red-500/30 bg-red-500/5 p-6 text-center">
				<p class="text-sm text-red-400">{error}</p>
				<button onclick={loadTemplates} class="mt-3 text-xs text-muted underline">Retry</button>
			</div>

		<!-- Empty state (should not occur in practice — seeded templates always present) -->
		{:else if templates.length === 0}
			<div class="rounded-2xl border border-border bg-surface p-10 text-center">
				<svg
					class="mx-auto mb-4 size-12 text-muted"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="1.5"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					<rect x="3" y="4" width="18" height="18" rx="2" />
					<path d="M16 2v4M8 2v4M3 10h18" />
				</svg>
				<h2 class="mb-1 text-base font-semibold text-text">No templates yet</h2>
				<p class="text-sm text-muted">Session templates will appear here.</p>
			</div>

		<!-- Template list -->
		{:else}
			<ul class="space-y-3">
				{#each templates as template (template.id)}
					<li class="group relative rounded-2xl border border-border bg-surface transition hover:border-cyan-600/40">
						<!-- Full-card link -->
						<a
							href="/sessions/{template.id}"
							class="absolute inset-0 rounded-2xl"
							aria-label={template.name}
						></a>

						<div class="flex items-center gap-4 p-4">
							<!-- Icon -->
							<div
								class="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border bg-surface-raised text-muted"
							>
								<svg
									class="size-5"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="1.75"
									stroke-linecap="round"
									stroke-linejoin="round"
								>
									<rect x="3" y="4" width="18" height="18" rx="2" />
									<path d="M16 2v4M8 2v4M3 10h18" />
								</svg>
							</div>

							<!-- Info -->
							<div class="min-w-0 flex-1">
								<p class="truncate font-semibold text-text transition-colors group-hover:text-cyan-300">
									{template.name}
								</p>
								{#if template.description}
									<p class="mt-0.5 line-clamp-2 text-xs text-muted">{template.description}</p>
								{/if}
							</div>

							<!-- Chevron -->
							<svg
								class="size-4 shrink-0 text-muted transition-colors group-hover:text-cyan-400"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
							>
								<polyline points="9 18 15 12 9 6" />
							</svg>
						</div>
					</li>
				{/each}
			</ul>
		{/if}
	</main>
</div>
