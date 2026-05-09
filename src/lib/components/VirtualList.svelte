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
	 *   items        — full list of items currently loaded
	 *   pageSize     — how many items to reveal per batch (default: 20)
	 *   key          — function returning a unique key for each item (for Svelte keyed each)
	 *   onLoadMore   — optional callback invoked when all loaded items are visible and
	 *                  more pages may exist; pass undefined when there are no more pages
	 *   resetToken   — change this value to reset the visible count (e.g. on new search)
	 */

	import { browser } from '$app/environment'

	interface Props<T> {
		items: T[]
		pageSize?: number
		key: (item: T) => string | number
		children: import('svelte').Snippet<[T]>
		onLoadMore?: () => void
		resetToken?: unknown
	}

	const { items, pageSize = 20, key, children, onLoadMore, resetToken }: Props<T> = $props()

	// ── Visible slice ─────────────────────────────────────────────────────────
	let visibleCount = $state(0)

	// Reset visible count when a new search starts (resetToken changes).
	$effect(() => {
		void resetToken
		visibleCount = pageSize
	})

	const visibleItems = $derived(items.slice(0, visibleCount))
	// Show sentinel while there are more local items to reveal, or while the
	// parent signals there are more API pages to load.
	const hasMore = $derived(visibleCount < items.length || !!onLoadMore)

	function revealNextBatch() {
		visibleCount = Math.min(visibleCount + pageSize, items.length)
	}

	// ── IntersectionObserver sentinel ─────────────────────────────────────────
	let sentinel = $state<Element | null>(null)
	let observer: IntersectionObserver | null = null

	function attachObserver(el: Element | null) {
		if (observer) {
			observer.disconnect()
			observer = null
		}
		if (!el || !browser) return
		observer = new IntersectionObserver(
			(entries) => {
				if (!entries[0]?.isIntersecting) return
				if (visibleCount < items.length) {
					revealNextBatch()
				} else {
					onLoadMore?.()
				}
			},
			{ rootMargin: '200px' }
		)
		observer.observe(el)
	}

	$effect(() => {
		attachObserver(sentinel)
		return () => {
			observer?.disconnect()
			observer = null
		}
	})
</script>

{#each visibleItems as item (key(item))}
	{@render children(item)}
{/each}

{#if hasMore}
	<!-- Sentinel: triggers next batch or API page load when it scrolls near the viewport -->
	<div bind:this={sentinel} aria-hidden="true" class="h-4 w-full"></div>
{/if}
