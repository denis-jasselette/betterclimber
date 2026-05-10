<script lang="ts">
	import { authClient } from '$lib/auth-client.svelte'
	import ImportPrompt from './ImportPrompt.svelte'

	// useSession() returns a nanostores Atom — subscribe with $session in the template
	const session = authClient.useSession()

	let showImportPrompt = $state(false)
	let importDone = $state(false)

	// After sign-in, show the import prompt once if not yet dismissed
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

	async function signIn() {
		// When signing in from a Netlify deploy preview, pass the current deploy-preview
		// URL as the callbackURL so production auth redirects back here after OAuth
		// completes. Production auth accepts deploy-preview origins via trustedOrigins.
		// On production or local dev the current URL is already the correct destination.
		await authClient.signIn.social({ provider: 'google', callbackURL: window.location.href })
	}

	async function signOut() {
		await authClient.signOut()
	}

	function onImportDone() {
		showImportPrompt = false
		importDone = true
	}

	function onImportSkip() {
		showImportPrompt = false
		importDone = true
	}
</script>

<section class="mb-8">
	<h2 class="mb-1 text-xs font-semibold tracking-wider text-muted uppercase">Account</h2>

	{#if $session.isPending}
		<p class="text-xs text-muted">Loading...</p>
	{:else if $session.data?.user}
		<!-- Authenticated state -->
		<div class="rounded-xl border border-border bg-surface px-4 py-3">
			<p class="mb-0.5 text-sm font-semibold text-text">{$session.data.user.email}</p>
			<p class="mb-3 text-xs text-muted">Ticks and likes are synced across your devices.</p>
			<button
				onclick={signOut}
				class="rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-muted transition hover:border-red-500/50 hover:text-red-400"
			>
				Sign out
			</button>
		</div>

		{#if showImportPrompt}
			<ImportPrompt onconfirm={onImportDone} onskip={onImportSkip} />
		{/if}
	{:else}
		<!-- Unauthenticated state -->
		<p class="mb-3 text-xs text-muted">
			Signing in is optional. Searching climbs and lighting the board work without an account. Sign
			in to sync your ticks and likes across devices.
		</p>
		<button
			onclick={signIn}
			class="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-surface px-4 py-3 text-sm font-medium text-text transition hover:border-cyan-600/60 hover:bg-cyan-600/5 active:scale-[0.99]"
		>
			<!-- Google "G" icon -->
			<svg viewBox="0 0 24 24" class="size-4" aria-hidden="true">
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
	{/if}
</section>
