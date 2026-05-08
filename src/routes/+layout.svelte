<script lang="ts">
	import './layout.css'
	import { untrack } from 'svelte'
	import { browser } from '$app/environment'
	import { page } from '$app/state'
	import SettingsPanel from '$lib/components/SettingsPanel.svelte'
	import { settings } from '$lib/settings-store.svelte'

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

	const settingsOpen = $derived(page.url.hash === '#settings')

	// Lock body scroll while settings panel is open
	$effect(() => {
		if (!browser) return
		document.body.style.overflow = settingsOpen ? 'hidden' : ''
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
		if (e.key === 'Escape' && settingsOpen) history.back()
	}}
/>

{@render children()}

{#if settingsOpen}
	<SettingsPanel />
{/if}
