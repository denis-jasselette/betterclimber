<script lang="ts">
	import './layout.css'
	import { untrack } from 'svelte'
	import { fade, fly } from 'svelte/transition'
	import { browser } from '$app/environment'
	import { page } from '$app/state'
	import type { GradingSystem, ThemePreference } from '$lib/settings-store.svelte'
	import { settings } from '$lib/settings-store.svelte'

	let { data, children } = $props()

	untrack(() => settings.init(data.settings))

	$effect(() => {
		if (!browser) return
		const pref = settings.theme
		const isDark =
			pref === 'dark' ||
			(pref === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
		document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light')
	})

	const settingsOpen = $derived(page.url.hash === '#settings')

	// Lock body scroll while settings panel is open
	$effect(() => {
		if (!browser) return
		document.body.style.overflow = settingsOpen ? 'hidden' : ''
		return () => {
			document.body.style.overflow = ''
		}
	})

	type OptionDef<T> = { value: T; label: string; description: string }

	const gradingOptions: OptionDef<GradingSystem>[] = [
		{ value: 'v-scale', label: 'V Scale', description: 'V0 – V17  (Hueco / American)' },
		{ value: 'french', label: 'French', description: '4 – 9A  (Fontainebleau)' }
	]

	const themeOptions: OptionDef<ThemePreference>[] = [
		{ value: 'system', label: 'System', description: 'Follow device setting' },
		{ value: 'dark', label: 'Dark', description: 'Always dark' },
		{ value: 'light', label: 'Light', description: 'Always light' }
	]
</script>

<svelte:head>
	<link rel="manifest" href="/manifest.webmanifest" />
</svelte:head>

<svelte:window
	onkeydown={(e) => {
		if (e.key === 'Escape' && settingsOpen) history.back()
	}}
/>

{@render children()}

{#if settingsOpen}
	<!-- Backdrop -->
	<div
		role="presentation"
		class="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
		onclick={() => history.back()}
		transition:fade={{ duration: 200 }}
	></div>

	<!-- Panel -->
	<div
		class="scrollbar-subtle fixed inset-y-0 right-0 z-50 w-full max-w-sm overflow-y-auto bg-bg shadow-2xl"
		transition:fly={{ x: 400, duration: 250, opacity: 1 }}
	>
		<div class="px-6 py-8">
			<!-- Header -->
			<div class="mb-8 flex items-center justify-between">
				<h1 class="text-xl font-bold text-text">Settings</h1>
				<button
					onclick={() => history.back()}
					aria-label="Close settings"
					class="flex size-8 items-center justify-center rounded-lg text-muted hover:text-text"
				>
					<svg
						class="size-5"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
					>
						<path d="M18 6 6 18M6 6l12 12" />
					</svg>
				</button>
			</div>

			<!-- Grading system -->
			<section class="mb-8">
				<h2 class="mb-1 text-xs font-semibold tracking-wider text-muted uppercase">
					Grading system
				</h2>
				<p class="mb-3 text-xs text-muted">
					Controls how grades are displayed everywhere in the app.
				</p>
				<div class="space-y-2">
					{#each gradingOptions as opt (opt.value)}
						<button
							onclick={() => (settings.gradingSystem = opt.value)}
							class="flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition active:scale-[0.99] {settings.gradingSystem ===
							opt.value
								? 'border-cyan-600 bg-cyan-600/10'
								: 'border-border bg-surface hover:border-border/60'}"
						>
							<span
								class="flex size-4 shrink-0 items-center justify-center rounded-full border-2 {settings.gradingSystem ===
								opt.value
									? 'border-cyan-500'
									: 'border-muted'}"
							>
								{#if settings.gradingSystem === opt.value}
									<span class="size-2 rounded-full bg-cyan-500"></span>
								{/if}
							</span>
							<div>
								<p
									class="text-sm font-semibold {settings.gradingSystem === opt.value
										? 'text-cyan-400'
										: 'text-text'}"
								>
									{opt.label}
								</p>
								<p class="text-xs text-muted">{opt.description}</p>
							</div>
						</button>
					{/each}
				</div>
			</section>

			<!-- Theme -->
			<section>
				<h2 class="mb-1 text-xs font-semibold tracking-wider text-muted uppercase">Theme</h2>
				<p class="mb-3 text-xs text-muted">Choose the colour scheme used throughout the app.</p>
				<div class="space-y-2">
					{#each themeOptions as opt (opt.value)}
						<button
							onclick={() => (settings.theme = opt.value)}
							class="flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition active:scale-[0.99] {settings.theme ===
							opt.value
								? 'border-cyan-600 bg-cyan-600/10'
								: 'border-border bg-surface hover:border-border/60'}"
						>
							<span
								class="flex size-4 shrink-0 items-center justify-center rounded-full border-2 {settings.theme ===
								opt.value
									? 'border-cyan-500'
									: 'border-muted'}"
							>
								{#if settings.theme === opt.value}
									<span class="size-2 rounded-full bg-cyan-500"></span>
								{/if}
							</span>
							<div>
								<p
									class="text-sm font-semibold {settings.theme === opt.value
										? 'text-cyan-400'
										: 'text-text'}"
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
	</div>
{/if}
