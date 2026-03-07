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
		<!-- Device name -->
		<span class="max-w-[120px] truncate text-xs font-medium text-text">{connectedLabel}</span>
		<!-- Disconnect button -->
		<button
			onclick={() => connector.disconnect()}
			class="rounded-lg border border-border bg-surface-raised px-2.5 py-1 text-xs font-medium text-text transition hover:bg-surface active:scale-95"
		>
			Disconnect
		</button>
	{:else if connector.status === 'connecting'}
		<span class="text-xs text-muted">Connecting…</span>
	{:else}
		<span class="text-xs text-muted">Not connected</span>
	{/if}
</div>
