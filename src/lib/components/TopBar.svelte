<script lang="ts">
	import { connector } from '$lib/connector.svelte'
	import type { Angle } from '$lib/data/types'
	import { sidebarStore } from '$lib/sidebar-store.svelte'
	import AngleDropdown from './AngleDropdown.svelte'
	import BleStatus from './BleStatus.svelte'

	interface Props {
		angle?: Angle | null
		hideBoardControls?: boolean
		children?: import('svelte').Snippet
	}

	const { children, angle = null, hideBoardControls = false }: Props = $props()
</script>

<header class="sticky top-0 z-30 border-b border-border bg-bg/90 backdrop-blur-sm">
	<div class="mx-auto flex max-w-full items-center gap-3 px-4 py-3">
		<!-- Hamburger (mobile only) -->
		<button
			type="button"
			onclick={() => sidebarStore.toggle()}
			aria-label="Open navigation"
			class="flex size-9 items-center justify-center rounded-xl border border-border bg-surface-raised text-muted transition hover:text-text active:scale-95 lg:hidden"
		>
			<svg
				class="size-4"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
			>
				<line x1="3" y1="6" x2="21" y2="6" />
				<line x1="3" y1="12" x2="21" y2="12" />
				<line x1="3" y1="18" x2="21" y2="18" />
			</svg>
		</button>

		<!-- Logo (mobile only — hidden on desktop where sidebar shows it) -->
		<a href="/" class="flex items-center gap-2 lg:hidden">
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
		</a>

		<div class="flex-1"></div>

		<!-- BLE status -->
		{#if !hideBoardControls}
			<BleStatus {connector} />
		{/if}

		<!-- Angle dropdown -->
		{#if !hideBoardControls}
			<AngleDropdown {angle} />
		{/if}

		<!-- Extra items (e.g. filter toggle) -->
		{@render children?.()}

		<!-- Profile icon (placeholder) -->
		<button
			type="button"
			aria-label="Profile"
			class="flex size-9 items-center justify-center rounded-xl border border-border bg-surface-raised text-muted transition hover:border-border hover:text-text active:scale-95"
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
				<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
				<circle cx="12" cy="7" r="4" />
			</svg>
		</button>
	</div>
</header>
