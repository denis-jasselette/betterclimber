<script lang="ts">
	import { fade } from 'svelte/transition'
	import { page } from '$app/state'

	interface Props {
		open?: boolean
		onclose?: () => void
	}

	const { open = false, onclose }: Props = $props()

	const navLinks = [
		{
			href: '/',
			label: 'Home',
			icon: `<path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z"/><polyline points="9 21 9 12 15 12 15 21"/>`,
			exact: true
		},
		{
			href: '/playlists',
			label: 'Playlists',
			icon: `<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>`,
			exact: false
		},
		{
			href: '/sessions',
			label: 'Sessions',
			icon: `<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>`,
			exact: false
		},
		{
			href: '/stats',
			label: 'Stats',
			icon: `<rect x="3" y="12" width="4" height="9" rx="1"/><rect x="10" y="7" width="4" height="14" rx="1"/><rect x="17" y="3" width="4" height="18" rx="1"/>`,
			exact: false
		}
	]

	const settingsLink = {
		href: '/settings',
		label: 'Settings',
		icon: `<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>`
	}

	function isActive(href: string, exact: boolean): boolean {
		const pathname = page.url.pathname
		if (exact) return pathname === href
		return pathname === href || pathname.startsWith(`${href}/`)
	}

	function handleNavClick() {
		onclose?.()
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') onclose?.()
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- Mobile: backdrop -->
{#if open}
	<div
		role="presentation"
		class="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
		onclick={onclose}
		transition:fade={{ duration: 200 }}
	></div>
{/if}

<!-- Sidebar panel -->
<nav
	class="fixed inset-y-0 left-0 z-50 flex w-60 flex-col border-r border-border bg-bg transition-transform duration-300 lg:sticky lg:top-0 lg:z-auto lg:h-screen lg:translate-x-0 lg:transition-none {open
		? 'translate-x-0'
		: '-translate-x-full lg:translate-x-0'}"
	aria-label="Main navigation"
>
	<!-- Nav links -->
	<div class="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-4">
		{#each navLinks as link (link.href)}
			<a
				href={link.href}
				onclick={handleNavClick}
				class="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition {isActive(
					link.href,
					link.exact
				)
					? 'bg-cyan-600/15 text-cyan-400'
					: 'text-muted hover:bg-surface hover:text-text'}"
				aria-current={isActive(link.href, link.exact) ? 'page' : undefined}
			>
				<svg
					class="size-4 shrink-0"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					stroke-width="1.75"
					stroke-linecap="round"
					stroke-linejoin="round"
				>
					{@html link.icon}
				</svg>
				{link.label}
				{#if link.href === '/playlists'}
					<span class="ml-auto rounded-full bg-surface px-1.5 py-0.5 text-[10px] text-muted"
						>Soon</span
					>
				{/if}
			</a>
		{/each}

		<!-- Spacer -->
		<div class="flex-1"></div>

		<!-- Create custom climb -->
		<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
		<a
			href="/climb/new"
			title="Create custom climb"
			onclick={handleNavClick}
			class="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition {isActive(
				'/climb/new',
				true
			)
				? 'bg-cyan-600/15 text-cyan-400'
				: 'text-muted hover:bg-surface hover:text-text'}"
			aria-current={isActive('/climb/new', true) ? 'page' : undefined}
		>
			<svg
				class="size-4 shrink-0"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="1.75"
				stroke-linecap="round"
				stroke-linejoin="round"
			>
				<path d="M12 5v14M5 12h14" />
			</svg>
			New climb
		</a>

		<!-- Settings at bottom -->
		<a
			href={settingsLink.href}
			onclick={handleNavClick}
			class="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition {isActive(
				settingsLink.href,
				false
			)
				? 'bg-cyan-600/15 text-cyan-400'
				: 'text-muted hover:bg-surface hover:text-text'}"
			aria-current={isActive(settingsLink.href, false) ? 'page' : undefined}
		>
			<svg
				class="size-4 shrink-0"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="1.75"
				stroke-linecap="round"
				stroke-linejoin="round"
			>
				{@html settingsLink.icon}
			</svg>
			{settingsLink.label}
		</a>
	</div>
</nav>
