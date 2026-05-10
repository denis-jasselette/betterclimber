<script lang="ts">
	import { goto } from '$app/navigation'
	import { authClient } from '$lib/auth-client.svelte'
	import TopBar from '$lib/components/TopBar.svelte'
	import { apiCreatePlaylist } from '$lib/data/playlist-api'

	const session = authClient.useSession()

	// ── State ─────────────────────────────────────────────────────────────────

	type Playlist = {
		id: string
		name: string
		created_at: string
		item_count: number
	}

	let playlists = $state<Playlist[]>([])
	let loading = $state(true)
	let error = $state<string | null>(null)

	// New playlist creation
	let creating = $state(false)
	let newName = $state('')
	let createError = $state<string | null>(null)
	let saving = $state(false)

	// Delete confirmation
	let deletingId = $state<string | null>(null)

	// ── Load playlists ────────────────────────────────────────────────────────

	async function loadPlaylists() {
		loading = true
		error = null
		try {
			const res = await fetch('/api/playlists')
			if (res.status === 401) {
				loading = false
				return
			}
			if (!res.ok) throw new Error('Failed to load playlists')
			playlists = await res.json()
		} catch (e) {
			error = e instanceof Error ? e.message : 'Unknown error'
		} finally {
			loading = false
		}
	}

	$effect(() => {
		if ($session.data?.user) {
			loadPlaylists()
		} else if (!$session.isPending) {
			loading = false
		}
	})

	// ── Create playlist ───────────────────────────────────────────────────────

	function startCreating() {
		creating = true
		newName = ''
		createError = null
	}

	function cancelCreating() {
		creating = false
		newName = ''
		createError = null
	}

	async function createPlaylist() {
		const trimmed = newName.trim()
		if (!trimmed) {
			createError = 'Name is required'
			return
		}
		saving = true
		createError = null
		try {
			const created = await apiCreatePlaylist(trimmed)
			playlists = [created, ...playlists]
			creating = false
			newName = ''
		} catch (e) {
			createError = e instanceof Error ? e.message : 'Unknown error'
		} finally {
			saving = false
		}
	}

	function onNewNameKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') createPlaylist()
		if (e.key === 'Escape') cancelCreating()
	}

	// ── Delete playlist ───────────────────────────────────────────────────────

	function confirmDelete(id: string) {
		deletingId = id
	}

	function cancelDelete() {
		deletingId = null
	}

	async function deletePlaylist(id: string) {
		try {
			const res = await fetch(`/api/playlists/${id}`, { method: 'DELETE' })
			if (!res.ok) throw new Error('Failed to delete playlist')
			playlists = playlists.filter((p) => p.id !== id)
			deletingId = null
		} catch {
			deletingId = null
		}
	}

	// ── Helpers ───────────────────────────────────────────────────────────────

	function formatDate(iso: string) {
		return new Date(iso).toLocaleDateString(undefined, {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		})
	}

	async function signIn() {
		await authClient.signIn.social({ provider: 'google', callbackURL: window.location.href })
	}
</script>

<div class="min-h-screen bg-bg">
	<TopBar hideBoardControls />

	<main class="mx-auto max-w-2xl px-4 py-8">
		<div class="mb-6 flex items-center justify-between gap-4">
			<h1 class="text-2xl font-bold text-text">Playlists</h1>
			{#if $session.data?.user}
				<button
					onclick={startCreating}
					class="flex items-center gap-2 rounded-xl border border-cyan-600/50 bg-cyan-600/10 px-4 py-2 text-sm font-semibold text-cyan-400 transition hover:bg-cyan-600/20 active:scale-95"
				>
					<svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
						<path d="M12 5v14M5 12h14" />
					</svg>
					New playlist
				</button>
			{/if}
		</div>

		<!-- Unauthenticated -->
		{#if !$session.isPending && !$session.data?.user}
			<div class="rounded-2xl border border-border bg-surface p-8 text-center">
				<svg class="mx-auto mb-4 size-12 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
					<path d="M9 19V6l12-3v13" stroke-linecap="round" stroke-linejoin="round" />
					<circle cx="6" cy="19" r="3" />
					<circle cx="18" cy="16" r="3" />
				</svg>
				<h2 class="mb-2 text-lg font-semibold text-text">Sign in to use playlists</h2>
				<p class="mb-6 text-sm text-muted">Save and organise climbs into playlists for your training sessions.</p>
				<button
					onclick={signIn}
					class="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-5 py-2.5 text-sm font-medium text-text transition hover:border-cyan-600/60 hover:bg-cyan-600/5 active:scale-[0.99]"
				>
					<svg viewBox="0 0 24 24" class="size-4" aria-hidden="true">
						<path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
						<path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
						<path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
						<path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
					</svg>
					Sign in with Google
				</button>
			</div>

		<!-- Loading -->
		{:else if loading}
			<div class="space-y-3">
				{#each [1, 2, 3] as i (i)}
					<div class="h-20 animate-pulse rounded-2xl border border-border bg-surface"></div>
				{/each}
			</div>

		<!-- Error -->
		{:else if error}
			<div class="rounded-2xl border border-red-500/30 bg-red-500/5 p-6 text-center">
				<p class="text-sm text-red-400">{error}</p>
				<button onclick={loadPlaylists} class="mt-3 text-xs text-muted underline">Retry</button>
			</div>

		{:else}
			<!-- New playlist inline form -->
			{#if creating}
				<div class="mb-4 rounded-2xl border border-cyan-600/40 bg-surface p-4">
					<p class="mb-2 text-sm font-semibold text-text">New playlist</p>
					<div class="flex gap-2">
						<!-- svelte-ignore a11y_autofocus -->
						<input
							type="text"
							bind:value={newName}
							onkeydown={onNewNameKeydown}
							placeholder="Playlist name…"
							autofocus
							maxlength="80"
							class="min-w-0 flex-1 rounded-xl border border-border bg-surface-raised px-3 py-2 text-sm text-text placeholder:text-muted focus:border-cyan-600/60 focus:outline-none"
						/>
						<button
							onclick={createPlaylist}
							disabled={saving}
							class="rounded-xl border border-cyan-600/50 bg-cyan-600/10 px-4 py-2 text-sm font-semibold text-cyan-400 transition hover:bg-cyan-600/20 disabled:opacity-50"
						>
							{saving ? 'Saving…' : 'Create'}
						</button>
						<button
							onclick={cancelCreating}
							class="rounded-xl border border-border px-3 py-2 text-sm text-muted transition hover:text-text"
						>
							Cancel
						</button>
					</div>
					{#if createError}
						<p class="mt-2 text-xs text-red-400">{createError}</p>
					{/if}
				</div>
			{/if}

			<!-- Empty state -->
			{#if playlists.length === 0}
				<div class="rounded-2xl border border-border bg-surface p-8 text-center">
					<svg class="mx-auto mb-4 size-12 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
						<path d="M9 19V6l12-3v13" stroke-linecap="round" stroke-linejoin="round" />
						<circle cx="6" cy="19" r="3" />
						<circle cx="18" cy="16" r="3" />
					</svg>
					<h2 class="mb-2 text-lg font-semibold text-text">No playlists yet</h2>
					<p class="text-sm text-muted">
						Create a playlist and add climbs from the
						<a href="/" class="text-cyan-400 hover:underline">search page</a>.
					</p>
				</div>

			<!-- Playlist list -->
			{:else}
				<ul class="space-y-3">
					{#each playlists as playlist (playlist.id)}
						<li class="group relative rounded-2xl border border-border bg-surface p-4 transition hover:border-border">
							<!-- Card link -->
							<a
								href="/playlists/{playlist.id}"
								class="absolute inset-0 rounded-2xl"
								aria-label={playlist.name}
							></a>

							<div class="flex items-center gap-3">
								<!-- Icon -->
								<div class="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border bg-surface-raised text-muted">
									<svg class="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75">
										<path d="M9 19V6l12-3v13" stroke-linecap="round" stroke-linejoin="round" />
										<circle cx="6" cy="19" r="3" />
										<circle cx="18" cy="16" r="3" />
									</svg>
								</div>

								<!-- Info -->
								<div class="min-w-0 flex-1">
									<p class="truncate font-semibold text-text transition-colors group-hover:text-cyan-300">
										{playlist.name}
									</p>
									<p class="mt-0.5 text-xs text-muted">
										{playlist.item_count} {playlist.item_count === 1 ? 'climb' : 'climbs'} · {formatDate(playlist.created_at)}
									</p>
								</div>

								<!-- Delete button (desktop) / confirmation -->
								<div class="relative z-10 shrink-0">
									{#if deletingId === playlist.id}
										<div class="flex items-center gap-2">
											<span class="text-xs text-muted">Delete?</span>
											<button
												onclick={() => deletePlaylist(playlist.id)}
												class="rounded-lg border border-red-500/40 bg-red-500/10 px-2.5 py-1 text-xs font-semibold text-red-400 transition hover:bg-red-500/20"
											>
												Yes
											</button>
											<button
												onclick={cancelDelete}
												class="rounded-lg border border-border px-2.5 py-1 text-xs text-muted transition hover:text-text"
											>
												No
											</button>
										</div>
									{:else}
										<button
											onclick={() => confirmDelete(playlist.id)}
											aria-label="Delete playlist"
											class="flex size-8 items-center justify-center rounded-xl border border-border bg-surface-raised text-muted opacity-0 transition hover:border-red-500/40 hover:text-red-400 group-hover:opacity-100 active:scale-95"
										>
											<svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
												<polyline points="3 6 5 6 21 6" />
												<path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
												<path d="M10 11v6M14 11v6" />
												<path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
											</svg>
										</button>
									{/if}
								</div>
							</div>
						</li>
					{/each}
				</ul>
			{/if}
		{/if}
	</main>
</div>
