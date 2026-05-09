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

	import { untrack } from 'svelte'
	import { browser } from '$app/environment'

	interface Props<T> {
		items: T[]
		pageSize?: number
		key: (item: T) => string | number
		children: import('svelte').Snippet<[T]>
		onLoadMore?: () => void
		resetToken?: unknown
		/**
		 * When restoring a previous browse session (e.g. navigating back from a
		 * climb detail), pass the number of items that were visible so the list
		 * starts fully expanded rather than being reset to pageSize.
		 */
		initialVisibleCount?: number
	}

	const {
		items,
		pageSize = 20,
		key,
		children,
		onLoadMore,
		resetToken,
		initialVisibleCount = 0
	}: Props<T> = $props()

	// ── Visible slice ─────────────────────────────────────────────────────────
	let visibleCount = $state(0)

	// Reset visible count when a new search starts (resetToken changes).
	// When restoring from back-navigation, initialVisibleCount > 0 so we start
	// showing all previously-loaded items without the user having to re-scroll.
	$effect(() => {
		void resetToken
		visibleCount = Math.max(pageSize, initialVisibleCount)
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
	// Tracks whether the sentinel is currently inside the viewport (+rootMargin).
	let isIntersecting = $state(false)

	// When items are appended (onLoadMore resolved) while the sentinel is already
	// in the viewport, the observer won't fire again — no intersection transition
	// occurred. Kick off the first batch reveal manually so the observer can take
	// over from there (new items push the sentinel below the viewport, triggering
	// a real transition on subsequent scrolls).
	// Use untrack to read isIntersecting/visibleCount without making them
	// dependencies — this effect must only react to items.length growing.
	$effect(() => {
		void items.length
		if (untrack(() => isIntersecting) && untrack(() => visibleCount) < items.length) {
			revealNextBatch()
		}
	})

	function attachObserver(el: Element | null) {
		if (observer) {
			observer.disconnect()
			observer = null
		}
		if (!el || !browser) return
		observer = new IntersectionObserver(
			(entries) => {
				isIntersecting = entries[0]?.isIntersecting ?? false
				if (!isIntersecting) return
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
