<script lang="ts">
	import type { BoardConnector } from '$lib/ble/board-connector.svelte';

	let { connector }: { connector: BoardConnector } = $props();

	// Status dot colour
	const dotClass = $derived(
		connector.status === 'connected'
			? 'bg-green-500'
			: connector.status === 'connecting'
				? 'bg-yellow-400 animate-pulse'
				: connector.status === 'error'
					? 'bg-red-500'
					: 'bg-zinc-500'
	);

	const connectedLabel = $derived(connector.deviceName ?? 'Connected');
</script>

<!-- Compact BLE status widget for top bar -->
<div class="relative flex items-center gap-1.5">
	<!-- Status dot -->
	<span class="relative flex size-2 shrink-0">
		<span class="absolute inline-flex h-full w-full rounded-full {dotClass}"></span>
	</span>

	{#if connector.status === 'connected'}
		<!-- Device name: hidden on mobile, visible sm+ -->
		<span class="hidden max-w-[120px] truncate text-xs font-medium text-text sm:inline"
			>{connectedLabel}</span
		>
		<!-- Disconnect button: icon-only on mobile, text on sm+ -->
		<button
			onclick={() => connector.disconnect()}
			class="rounded-lg border border-border bg-surface-raised p-1 text-xs font-medium text-text transition hover:bg-surface active:scale-95 sm:px-2.5 sm:py-1"
			aria-label="Disconnect"
		>
			<!-- X icon: mobile only -->
			<svg
				class="size-3.5 shrink-0 sm:hidden"
				xmlns="http://www.w3.org/2000/svg"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2.5"
				stroke-linecap="round"
				stroke-linejoin="round"
				aria-hidden="true"
			>
				<line x1="18" y1="6" x2="6" y2="18" />
				<line x1="6" y1="6" x2="18" y2="18" />
			</svg>
			<!-- Text label: sm+ only -->
			<span class="hidden sm:inline">Disconnect</span>
		</button>
	{:else if connector.status === 'connecting'}
		<!-- Text hidden on mobile, visible sm+ -->
		<span class="hidden text-xs text-muted sm:inline">Connecting…</span>
	{:else}
		<!-- Text hidden on mobile, visible sm+ -->
		<span class="hidden text-xs text-muted sm:inline">Not connected</span>
	{/if}
</div>
