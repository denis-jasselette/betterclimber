<script lang="ts">
import './layout.css'
import { untrack } from 'svelte'
import { browser } from '$app/environment'
import { settings } from '$lib/settings-store.svelte'

let { data, children } = $props()

// Seed the store from the server-supplied cookie value so that SSR HTML and
// the first client render are always in agreement — no grading/theme flash.
// untrack() prevents the state_referenced_locally warning: init() is
// intentionally one-shot (seed only, not reactive tracking).
untrack(() => settings.init(data.settings))

// Keep data-theme in sync whenever the setting changes
$effect(() => {
	if (!browser) return
	const pref = settings.theme
	const isDark =
		pref === 'dark' ||
		(pref === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
	document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light')
})
</script>

<svelte:head>
	<link rel="manifest" href="/manifest.webmanifest" />
</svelte:head>

{@render children()}
