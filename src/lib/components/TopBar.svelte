<script lang="ts">
	import { goto } from '$app/navigation'
	import { page } from '$app/state'
	import { authClient } from '$lib/auth-client.svelte'
	import { connector } from '$lib/connector.svelte'
	import type { Angle } from '$lib/data/types'
	import { sidebarStore } from '$lib/sidebar-store.svelte'
	import AngleDropdown from './AngleDropdown.svelte'
	import BleStatus from './BleStatus.svelte'

	interface Props {
		angle?: Angle | null
		hideBoardControls?: boolean
		children?: import('svelte').Snippet
	}

	const { children, angle = null, hideBoardControls = false }: Props = $props()

	const session = authClient.useSession()

	let profileMenuOpen = $state(false)

	// Import prompt state (shown after sign-in when local data exists)
	let showImportPrompt = $state(false)
	let importDone = $state(false)
	let importError = $state<string | null>(null)
	let importing = $state(false)

	$effect(() => {
		if ($session.data?.user && !importDone) {
			checkPendingImport()
		}
	})

	async function checkPendingImport() {
		try {
			const res = await fetch('/api/log/import-status')
			if (res.ok) {
				const { hasPending } = (await res.json()) as { hasPending: boolean }
				if (hasPending) showImportPrompt = true
			}
		} catch {
			// Ignore
		}
	}

	function toggleProfileMenu() {
		profileMenuOpen = !profileMenuOpen
	}

	function closeProfileMenu() {
		profileMenuOpen = false
	}

	function signIn() {
		closeProfileMenu()
		const redirectTo = page.url.pathname + page.url.search
		goto(`/login?redirectTo=${encodeURIComponent(redirectTo)}`)
	}

	async function signOut() {
		closeProfileMenu()
		await authClient.signOut()
	}

	async function handleImport() {
		importing = true
		importError = null
		try {
			const res = await fetch('/api/log/import', { method: 'POST' })
			if (!res.ok) {
				importError = 'Import failed. Please try again.'
				return
			}
			showImportPrompt = false
			importDone = true
		} catch {
			importError = 'Import failed. Please try again.'
		} finally {
			importing = false
		}
	}

	function skipImport() {
		showImportPrompt = false
		importDone = true
	}
</script>

<svelte:window
	onkeydown={(e) => {
		if (e.key === 'Escape') closeProfileMenu()
	}}
/>

<!-- Click-outside backdrop for profile menu -->
{#if profileMenuOpen}
	<div
		role="presentation"
		class="fixed inset-0 z-40"
		onclick={closeProfileMenu}
	></div>
{/if}

<!-- Import prompt (shown after sign-in when local data exists) -->
{#if showImportPrompt}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
		<div class="w-full max-w-sm rounded-2xl border border-border bg-bg p-5 shadow-2xl">
			<p class="mb-1 text-sm font-semibold text-text">Import your data?</p>
			<p class="mb-3 text-xs text-muted">
				You have ticks and likes saved on this device. Would you like to import them into your
				account so they sync across devices?
			</p>
			{#if importError}
				<p class="mb-2 text-xs text-red-400">{importError}</p>
			{/if}
			<div class="flex gap-2">
				<button
					onclick={handleImport}
					disabled={importing}
					class="rounded-lg bg-cyan-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-cyan-500 disabled:opacity-50"
				>
					{importing ? 'Importing…' : 'Import'}
				</button>
				<button
					onclick={skipImport}
					disabled={importing}
					class="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted transition hover:text-text disabled:opacity-50"
				>
					Skip
				</button>
			</div>
		</div>
	</div>
{/if}

<header class="sticky top-0 z-30 border-b border-border bg-bg/90 backdrop-blur-sm">
	<div class="mx-auto flex max-w-full items-center gap-3 px-4 py-3">
		<!-- Hamburger (mobile only) -->
		<button
			type="button"
			onclick={() => sidebarStore.toggle()}
			aria-label="Open navigation"
			class="flex size-9 items-center justify-center rounded-xl border border-border bg-surface-raised text-muted transition hover:text-text active:scale-95 lg:hidden"
		>
			<svg
				class="size-4"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
			>
				<line x1="3" y1="6" x2="21" y2="6" />
				<line x1="3" y1="12" x2="21" y2="12" />
				<line x1="3" y1="18" x2="21" y2="18" />
			</svg>
		</button>

		<!-- Logo (always in navbar) -->
		<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
		<a href="/" class="flex items-center gap-2">
			<svg
				class="size-6 text-cyan-400"
				xmlns="http://www.w3.org/2000/svg"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
			>
				<rect x="3" y="3" width="18" height="18" rx="2" />
				<circle cx="8" cy="8" r="1.5" fill="currentColor" stroke="none" />
				<circle cx="12" cy="8" r="1.5" fill="currentColor" stroke="none" />
				<circle cx="16" cy="8" r="1.5" fill="currentColor" stroke="none" />
				<circle cx="8" cy="12" r="1.5" fill="currentColor" stroke="none" />
				<circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
				<circle cx="16" cy="12" r="1.5" fill="currentColor" stroke="none" />
				<circle cx="8" cy="16" r="1.5" fill="currentColor" stroke="none" />
				<circle cx="12" cy="16" r="1.5" fill="currentColor" stroke="none" />
				<circle cx="16" cy="16" r="1.5" fill="currentColor" stroke="none" />
			</svg>
			<span class="hidden text-base font-bold tracking-tight text-text sm:inline">Kilterboard</span>
		</a>

		<div class="flex-1"></div>

		<!-- BLE status -->
		{#if !hideBoardControls}
			<BleStatus {connector} />
		{/if}

		<!-- Angle dropdown -->
		{#if !hideBoardControls}
			<AngleDropdown {angle} />
		{/if}

		<!-- Extra items (e.g. filter toggle) -->
		{@render children?.()}

		<!-- Profile icon with popup menu -->
		<div class="relative">
			<button
				type="button"
				aria-label="Profile"
				aria-expanded={profileMenuOpen}
				aria-haspopup="menu"
				onclick={toggleProfileMenu}
				class="flex size-9 items-center justify-center rounded-xl border border-border bg-surface-raised text-muted transition hover:border-border hover:text-text active:scale-95"
			>
				{#if $session.data?.user}
					<!-- Filled user icon when signed in -->
					<svg
						class="size-4 text-cyan-400"
						viewBox="0 0 24 24"
						fill="currentColor"
						stroke="none"
					>
						<path d="M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10zm-7 8a7 7 0 0 1 14 0H5z" />
					</svg>
				{:else}
					<!-- Outlined user icon when signed out -->
					<svg
						class="size-4"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="1.75"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
						<circle cx="12" cy="7" r="4" />
					</svg>
				{/if}
			</button>

			<!-- Dropdown menu -->
			{#if profileMenuOpen}
				<div
					role="menu"
					class="absolute right-0 top-full z-50 mt-2 w-56 rounded-xl border border-border bg-bg shadow-xl"
				>
					{#if $session.isPending}
						<div class="px-4 py-3 text-xs text-muted">Loading...</div>
					{:else if $session.data?.user}
						<div class="border-b border-border px-4 py-3">
							<p class="truncate text-sm font-semibold text-text">{$session.data.user.email}</p>
							<p class="text-xs text-muted">Signed in</p>
						</div>
						<div class="p-1">
							<button
								role="menuitem"
								type="button"
								onclick={signOut}
								class="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted transition hover:bg-surface hover:text-red-400"
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
									<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
									<polyline points="16 17 21 12 16 7" />
									<line x1="21" y1="12" x2="9" y2="12" />
								</svg>
								Sign out
							</button>
						</div>
					{:else}
						<div class="p-1">
							<button
								role="menuitem"
								type="button"
								onclick={signIn}
								class="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-text transition hover:bg-surface"
							>
								<!-- Google "G" icon -->
								<svg viewBox="0 0 24 24" class="size-4 shrink-0" aria-hidden="true">
									<path
										d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
										fill="#4285F4"
									/>
									<path
										d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
										fill="#34A853"
									/>
									<path
										d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
										fill="#FBBC05"
									/>
									<path
										d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
										fill="#EA4335"
									/>
								</svg>
								Sign in with Google
							</button>
						</div>
					{/if}
				</div>
			{/if}
		</div>
	</div>
</header>
