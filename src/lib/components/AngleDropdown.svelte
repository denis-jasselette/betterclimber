<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { ALL_ANGLES } from '$lib/data/types';

	let {
		angle
	}: {
		angle: number | null;
	} = $props();

	let open = $state(false);
	let buttonEl = $state<HTMLButtonElement | null>(null);

	function select(value: number) {
		open = false;
		// Update the URL search param — the load function will re-run and
		// the page component will sync the store from page data.
		const url = new URL(page.url);
		url.searchParams.set('angle', String(value));
		goto(url.toString(), { replaceState: true, keepFocus: true, noScroll: true });
	}

	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') open = false;
	}

	// Close on outside click
	function onOutsideClick(e: MouseEvent) {
		if (buttonEl && !buttonEl.closest('[data-dropdown]')?.contains(e.target as Node)) {
			open = false;
		}
	}
</script>

<svelte:window onkeydown={onKeydown} onclick={onOutsideClick} />

<div data-dropdown class="relative">
	<button
		bind:this={buttonEl}
		onclick={(e) => {
			e.stopPropagation();
			open = !open;
		}}
		class="flex h-9 items-center gap-1.5 rounded-xl border px-3 text-sm font-semibold transition active:scale-95
			{angle !== null
			? 'border-orange-500 bg-orange-500/15 text-orange-300'
			: 'border-border bg-surface-raised text-muted hover:border-border hover:text-text'}"
	>
		<!-- Angle icon -->
		<svg
			class="size-4 shrink-0"
			xmlns="http://www.w3.org/2000/svg"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
		>
			<path d="M3 20h18M3 20 12 4l9 16" />
		</svg>
		<span>{angle !== null ? `${angle}°` : 'Angle'}</span>
		<svg
			class="size-3.5 shrink-0 transition-transform {open ? 'rotate-180' : ''}"
			xmlns="http://www.w3.org/2000/svg"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2.5"
		>
			<path d="m6 9 6 6 6-6" />
		</svg>
	</button>

	{#if open}
		<div
			class="absolute top-full right-0 z-50 mt-1.5 min-w-[7rem] overflow-hidden rounded-xl border border-border bg-surface shadow-2xl"
		>
			{#each ALL_ANGLES as a}
				<button
					onclick={() => select(a)}
					class="flex w-full items-center justify-between gap-3 px-3.5 py-2.5 text-sm transition hover:bg-surface-raised
						{angle === a ? 'font-semibold text-orange-300' : 'text-text/80'}"
				>
					{a}°
					{#if angle === a}
						<svg
							class="size-3.5 text-orange-400"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="3"
						>
							<path d="M20 6 9 17l-5-5" />
						</svg>
					{/if}
				</button>
			{/each}
		</div>
	{/if}
</div>
