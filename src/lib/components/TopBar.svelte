<script lang="ts">
import { connector } from '$lib/connector.svelte'
import { searchStore } from '$lib/search-store.svelte'
import AngleDropdown from './AngleDropdown.svelte'
import BleStatus from './BleStatus.svelte'
import SettingsButton from './SettingsButton.svelte'

interface Props {
	/** Override the angle shown in the dropdown (e.g. pass `data.angle` from
	 *  the load function so the correct value is present on SSR/hard-refresh
	 *  before the store has been hydrated from the URL). Falls back to the
	 *  store value when not provided. */
	angle?: number | null
	children?: import('svelte').Snippet
}

const { children, angle: angleProp = undefined }: Props = $props()

// Use the prop value when available (covers SSR + hard-refresh), otherwise
// fall back to the reactive store value (covers client-side navigation where
// the prop is not passed).
const displayAngle = $derived(angleProp !== undefined ? angleProp : searchStore.angle)
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

	<!-- BLE status -->
	<BleStatus {connector} />

	<!-- Angle dropdown -->
	<AngleDropdown angle={displayAngle} />

	<!-- Extra items (e.g. filter toggle) -->
	{@render children?.()}

	<!-- Settings -->
	<SettingsButton />
	</div>
</header>
