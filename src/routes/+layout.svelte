<script lang="ts">
	import './layout.css'
	import { untrack } from 'svelte'
	import { browser } from '$app/environment'
	import { afterNavigate } from '$app/navigation'
	import Sidebar from '$lib/components/Sidebar.svelte'
	import { settings } from '$lib/settings-store.svelte'
	import { sidebarStore } from '$lib/sidebar-store.svelte'

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

	// Close drawer on navigation
	afterNavigate(() => {
		sidebarStore.close()
	})

	// Lock body scroll while sidebar drawer is open on mobile
	$effect(() => {
		if (!browser) return
		document.body.style.overflow = sidebarStore.open ? 'hidden' : ''
		return () => {
			document.body.style.overflow = ''
		}
	})
</script>

<svelte:head>
	<link rel="manifest" href="/manifest.webmanifest" />
</svelte:head>

<svelte:window
	onkeydown={(e) => {
		if (e.key === 'Escape' && sidebarStore.open) sidebarStore.close()
	}}
/>

<div class="flex min-h-screen bg-bg text-text">
	<!-- Sidebar (persistent on desktop, drawer on mobile) -->
	<Sidebar open={sidebarStore.open} onclose={() => sidebarStore.close()} />

	<!-- Main content area -->
	<div class="flex min-w-0 flex-1 flex-col">
		{@render children()}
	</div>
</div>
