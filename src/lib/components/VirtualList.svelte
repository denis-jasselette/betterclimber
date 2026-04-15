<script lang="ts" generics="T">
	/**
	 * VirtualList
	 *
	 * Renders items in batches using an IntersectionObserver sentinel at the bottom.
	 * When the sentinel enters the viewport, the next page of items is appended.
	 *
	 * This keeps the DOM lean for large result sets while remaining simpler and more
	 * robust than a windowed virtualiser (no fixed row-height assumptions required).
	 *
	 * Props:
	 *   items      — full list of items to render
	 *   pageSize   — how many items to load per batch (default: 20)
	 *   key        — function returning a unique key for each item (for Svelte keyed each)
	 */

	import { browser } from '$app/environment';

	interface Props<T> {
		items: T[];
		pageSize?: number;
		key: (item: T) => string | number;
		children: import('svelte').Snippet<[T]>;
	}

	const { items, pageSize = 20, key, children }: Props<T> = $props();

	// ── Visible slice ─────────────────────────────────────────────────────────
	let visibleCount = $state(0);

	// Initialise and reset visible count whenever the item list or pageSize changes
	$effect(() => {
		// Access both to register as dependencies
		const _items = items;
		const _ps = pageSize;
		_items; // eslint-disable-line @typescript-eslint/no-unused-expressions
		visibleCount = _ps;
	});

	const visibleItems = $derived(items.slice(0, visibleCount));
	const hasMore = $derived(visibleCount < items.length);

	function loadMore() {
		visibleCount = Math.min(visibleCount + pageSize, items.length);
	}

	// ── IntersectionObserver sentinel ─────────────────────────────────────────
	let sentinel = $state<Element | null>(null);
	let observer: IntersectionObserver | null = null;

	function attachObserver(el: Element | null) {
		if (observer) {
			observer.disconnect();
			observer = null;
		}
		if (!el || !browser) return;
		observer = new IntersectionObserver(
			(entries) => {
				if (entries[0]?.isIntersecting) {
					loadMore();
				}
			},
			{ rootMargin: '200px' }
		);
		observer.observe(el);
	}

	$effect(() => {
		attachObserver(sentinel);
		return () => {
			observer?.disconnect();
			observer = null;
		};
	});
</script>

{#each visibleItems as item (key(item))}
	{@render children(item)}
{/each}

{#if hasMore}
	<!-- Sentinel: triggers next page load when it scrolls near the viewport -->
	<div bind:this={sentinel} aria-hidden="true" class="h-4 w-full"></div>
{/if}
