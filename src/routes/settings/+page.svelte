<script lang="ts">
	import { resolve } from '$app/paths';
	import { settings } from '$lib/settings-store.svelte';
	import type { GradingSystem, ThemePreference } from '$lib/settings-store.svelte';

	type OptionDef<T> = { value: T; label: string; description: string };

	const gradingOptions: OptionDef<GradingSystem>[] = [
		{ value: 'v-scale', label: 'V Scale', description: 'V0 – V17  (Hueco / American)' },
		{ value: 'french', label: 'French', description: '4 – 9A  (Fontainebleau)' }
	];

	const themeOptions: OptionDef<ThemePreference>[] = [
		{ value: 'system', label: 'System', description: 'Follow device setting' },
		{ value: 'dark', label: 'Dark', description: 'Always dark' },
		{ value: 'light', label: 'Light', description: 'Always light' }
	];
</script>

<svelte:head>
	<title>Settings – Kilter Board</title>
</svelte:head>

<div class="mx-auto max-w-lg px-4 py-8">
	<!-- Back link -->
	<a
		href={resolve('/')}
		class="mb-6 inline-flex items-center gap-1.5 text-sm text-muted hover:text-text"
	>
		<svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
			<path d="M19 12H5M12 5l-7 7 7 7" />
		</svg>
		Back
	</a>

	<h1 class="mb-8 text-xl font-bold text-text">Settings</h1>

	<!-- Grading system ───────────────────────────────────────────────── -->
	<section class="mb-8">
		<h2 class="mb-1 text-xs font-semibold tracking-wider text-muted uppercase">Grading system</h2>
		<p class="mb-3 text-xs text-muted">Controls how grades are displayed everywhere in the app.</p>
		<div class="space-y-2">
			{#each gradingOptions as opt (opt.value)}
				<button
					onclick={() => (settings.gradingSystem = opt.value)}
					class="flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition active:scale-[0.99]
						{settings.gradingSystem === opt.value
						? 'border-cyan-600 bg-cyan-600/10'
						: 'border-border bg-surface hover:border-border/60'}"
				>
					<!-- Radio dot -->
					<span
						class="flex size-4 shrink-0 items-center justify-center rounded-full border-2
						{settings.gradingSystem === opt.value ? 'border-cyan-500' : 'border-muted'}"
					>
						{#if settings.gradingSystem === opt.value}
							<span class="size-2 rounded-full bg-cyan-500"></span>
						{/if}
					</span>
					<div>
						<p
							class="text-sm font-semibold
							{settings.gradingSystem === opt.value ? 'text-cyan-400' : 'text-text'}"
						>
							{opt.label}
						</p>
						<p class="text-xs text-muted">{opt.description}</p>
					</div>
				</button>
			{/each}
		</div>
	</section>

	<!-- Theme ────────────────────────────────────────────────────────── -->
	<section>
		<h2 class="mb-1 text-xs font-semibold tracking-wider text-muted uppercase">Theme</h2>
		<p class="mb-3 text-xs text-muted">Choose the colour scheme used throughout the app.</p>
		<div class="space-y-2">
			{#each themeOptions as opt (opt.value)}
				<button
					onclick={() => (settings.theme = opt.value)}
					class="flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition active:scale-[0.99]
						{settings.theme === opt.value
						? 'border-cyan-600 bg-cyan-600/10'
						: 'border-border bg-surface hover:border-border/60'}"
				>
					<span
						class="flex size-4 shrink-0 items-center justify-center rounded-full border-2
						{settings.theme === opt.value ? 'border-cyan-500' : 'border-muted'}"
					>
						{#if settings.theme === opt.value}
							<span class="size-2 rounded-full bg-cyan-500"></span>
						{/if}
					</span>
					<div>
						<p
							class="text-sm font-semibold
							{settings.theme === opt.value ? 'text-cyan-400' : 'text-text'}"
						>
							{opt.label}
						</p>
						<p class="text-xs text-muted">{opt.description}</p>
					</div>
				</button>
			{/each}
		</div>
	</section>
</div>
