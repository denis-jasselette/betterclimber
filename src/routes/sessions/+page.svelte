<script lang="ts">
	import TopBar from '$lib/components/TopBar.svelte'

	let { data } = $props()
</script>

<svelte:head>
	<title>Session Library — BetterClimber</title>
</svelte:head>

<div class="min-h-screen bg-bg text-text">
	<TopBar hideBoardControls />

	<main class="mx-auto max-w-2xl px-4 py-8">
		<!-- Page header -->
		<div class="mb-6">
			<h1 class="text-2xl font-bold text-text">Session Library</h1>
			<p class="mt-1 text-sm text-muted">Structured training templates for the Kilter Board</p>
		</div>

		<!-- Template list -->
		{#if data.templates.length === 0}
			<div class="rounded-2xl border border-border bg-surface p-10 text-center">
				<svg
					class="mx-auto mb-4 size-12 text-muted"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="1.5"
				>
					<rect x="3" y="4" width="18" height="18" rx="2" />
					<path d="M16 2v4M8 2v4M3 10h18" stroke-linecap="round" />
				</svg>
				<h2 class="mb-2 text-lg font-semibold text-text">No templates yet</h2>
				<p class="text-sm text-muted">Check back soon — session templates are coming.</p>
			</div>
		{:else}
			<ul class="space-y-3">
				{#each data.templates as template (template.id)}
					<li class="group relative rounded-2xl border border-border bg-surface p-5 transition hover:border-cyan-600/40 hover:bg-surface-raised">
						<!-- Full-card link -->
						<a
							href="/sessions/{template.id}"
							class="absolute inset-0 rounded-2xl"
							aria-label={template.name}
						></a>

						<div class="flex items-start gap-4">
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
								>
									<rect x="3" y="4" width="18" height="18" rx="2" />
									<path d="M16 2v4M8 2v4M3 10h18" stroke-linecap="round" />
								</svg>
							</div>

							<!-- Info -->
							<div class="min-w-0 flex-1">
								<p
									class="font-semibold text-text transition-colors group-hover:text-cyan-300"
								>
									{template.name}
								</p>
								{#if template.description}
									<p class="mt-1 line-clamp-2 text-sm text-muted">{template.description}</p>
								{/if}
								<p class="mt-2 text-xs text-muted">
									{template.block_count}
									{template.block_count === 1 ? 'block' : 'blocks'}
								</p>
							</div>

							<!-- Chevron -->
							<svg
								class="mt-0.5 size-4 shrink-0 text-muted transition group-hover:text-cyan-400"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
							>
								<path d="M9 18l6-6-6-6" stroke-linecap="round" stroke-linejoin="round" />
							</svg>
						</div>
					</li>
				{/each}
			</ul>
		{/if}
	</main>
</div>
