<script lang="ts">
	import { page } from '$app/state'
	import { connector } from '$lib/connector.svelte'
	import AngleDropdown from './AngleDropdown.svelte'
	import BleStatus from './BleStatus.svelte'
	import SettingsButton from './SettingsButton.svelte'

	interface Props {
		angle?: number | null
		children?: import('svelte').Snippet
	}

	const { children, angle = null }: Props = $props()
	const onStatsPage = $derived(page.url.pathname === '/stats')
</script>

<header class="sticky top-0 z-50 border-b border-border bg-bg/90 backdrop-blur-sm">
	<div class="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
	<!-- Logo + title -->
	<div class="flex items-center gap-2">
		<svg
			class="size-6 text-cyan-400"
			xmlns="http://www.w3.org/2000/svg"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
		>
			<rect x="3" y="3" width="18" height="18" rx="2" />
			<circle cx="8" cy="8" r="1.5" fill="currentColor" stroke="none" />
			<circle cx="12" cy="8" r="1.5" fill="currentColor" stroke="none" />
			<circle cx="16" cy="8" r="1.5" fill="currentColor" stroke="none" />
			<circle cx="8" cy="12" r="1.5" fill="currentColor" stroke="none" />
			<circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
			<circle cx="16" cy="12" r="1.5" fill="currentColor" stroke="none" />
			<circle cx="8" cy="16" r="1.5" fill="currentColor" stroke="none" />
			<circle cx="12" cy="16" r="1.5" fill="currentColor" stroke="none" />
			<circle cx="16" cy="16" r="1.5" fill="currentColor" stroke="none" />
		</svg>
		<span class="hidden text-base font-bold tracking-tight text-text sm:inline">Kilterboard</span>
	</div>

	<div class="flex-1"></div>

	<!-- Stats link -->
	<a
		href="/stats"
		class="rounded-lg p-1.5 transition {onStatsPage
			? 'text-cyan-400'
			: 'text-muted hover:text-text'}"
		aria-label="Training stats"
	>
		<svg
			class="size-5"
			xmlns="http://www.w3.org/2000/svg"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
		>
			<rect x="3" y="12" width="4" height="9" rx="1" />
			<rect x="10" y="7" width="4" height="14" rx="1" />
			<rect x="17" y="3" width="4" height="18" rx="1" />
		</svg>
	</a>

	<!-- BLE status -->
	<BleStatus {connector} />

	<!-- Angle dropdown -->
	<AngleDropdown {angle} />

	<!-- Extra items (e.g. filter toggle) -->
	{@render children?.()}

	<!-- Settings -->
	<SettingsButton />
	</div>
</header>
