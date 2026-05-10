<script lang="ts">
	import { goto } from '$app/navigation'
	import { page } from '$app/state'
	import { authClient } from '$lib/auth-client.svelte'
	import TopBar from '$lib/components/TopBar.svelte'

	const session = authClient.useSession()

	// ── Types ─────────────────────────────────────────────────────────────────

	type PlaylistItem = {
		id: string
		playlist_id: string
		climb_uuid: string
		position: number
		added_at: string
		// Climb data enriched client-side after fetch
		climb_name?: string
		climb_grade?: string
	}

	type Playlist = {
		id: string
		name: string
		created_at: string
		user_id: string
		items: PlaylistItem[]
	}

	// ── State ─────────────────────────────────────────────────────────────────

	let playlist = $state<Playlist | null>(null)
	let loading = $state(true)
	let error = $state<string | null>(null)

	// Rename
	let renaming = $state(false)
	let renameName = $state('')
	let renameError = $state<string | null>(null)
	let renameSaving = $state(false)

	// Delete playlist
	let deletingPlaylist = $state(false)

	// Remove item confirmation
	let removingItemId = $state<string | null>(null)

	// Reorder drag state
	let dragItemId = $state<string | null>(null)
	let dragOverItemId = $state<string | null>(null)

	// ── Load ──────────────────────────────────────────────────────────────────

	const playlistId = $derived(page.params.id)

	async function loadPlaylist() {
		loading = true
		error = null
		try {
			const res = await fetch(`/api/playlists/${playlistId}`)
			if (res.status === 404) {
				error = 'Playlist not found'
				loading = false
				return
			}
			if (res.status === 401) {
				loading = false
				return
			}
			if (!res.ok) throw new Error('Failed to load playlist')
			playlist = await res.json()
		} catch (e) {
			error = e instanceof Error ? e.message : 'Unknown error'
		} finally {
			loading = false
		}
	}

	$effect(() => {
		if ($session.data?.user) {
			loadPlaylist()
		} else if (!$session.isPending) {
			loading = false
		}
	})

	// ── Rename ────────────────────────────────────────────────────────────────

	function startRename() {
		if (!playlist) return
		renameName = playlist.name
		renameError = null
		renaming = true
	}

	function cancelRename() {
		renaming = false
		renameError = null
	}

	async function saveRename() {
		const trimmed = renameName.trim()
		if (!trimmed) {
			renameError = 'Name is required'
			return
		}
		renameSaving = true
		renameError = null
		try {
			const res = await fetch(`/api/playlists/${playlistId}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name: trimmed })
			})
			if (!res.ok) throw new Error('Failed to rename')
			if (playlist) playlist = { ...playlist, name: trimmed }
			renaming = false
		} catch (e) {
			renameError = e instanceof Error ? e.message : 'Unknown error'
		} finally {
			renameSaving = false
		}
	}

	function onRenameKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') saveRename()
		if (e.key === 'Escape') cancelRename()
	}

	// ── Delete playlist ───────────────────────────────────────────────────────

	async function deletePlaylist() {
		try {
			const res = await fetch(`/api/playlists/${playlistId}`, { method: 'DELETE' })
			if (!res.ok) throw new Error('Failed to delete')
			goto('/playlists')
		} catch {
			deletingPlaylist = false
		}
	}

	// ── Remove item ───────────────────────────────────────────────────────────

	function confirmRemoveItem(id: string) {
		removingItemId = id
	}

	function cancelRemoveItem() {
		removingItemId = null
	}

	async function removeItem(itemId: string) {
		try {
			const res = await fetch(`/api/playlists/${playlistId}/items/${itemId}`, { method: 'DELETE' })
			if (!res.ok) throw new Error('Failed to remove')
			if (playlist) {
				playlist = {
					...playlist,
					items: playlist.items
						.filter((i) => i.id !== itemId)
						.map((item, idx) => ({ ...item, position: idx }))
				}
			}
			removingItemId = null
		} catch {
			removingItemId = null
		}
	}

	// ── Reorder (drag and drop) ───────────────────────────────────────────────

	function onDragStart(e: DragEvent, itemId: string) {
		dragItemId = itemId
		if (e.dataTransfer) {
			e.dataTransfer.effectAllowed = 'move'
		}
	}

	function onDragOver(e: DragEvent, itemId: string) {
		e.preventDefault()
		dragOverItemId = itemId
	}

	function onDragLeave() {
		dragOverItemId = null
	}

	async function onDrop(e: DragEvent, targetItemId: string) {
		e.preventDefault()
		dragOverItemId = null

		if (!dragItemId || dragItemId === targetItemId || !playlist) {
			dragItemId = null
			return
		}

		const items = [...playlist.items]
		const fromIdx = items.findIndex((i) => i.id === dragItemId)
		const toIdx = items.findIndex((i) => i.id === targetItemId)

		if (fromIdx === -1 || toIdx === -1) {
			dragItemId = null
			return
		}

		// Reorder locally
		const [moved] = items.splice(fromIdx, 1)
		items.splice(toIdx, 0, moved)
		const reordered = items.map((item, idx) => ({ ...item, position: idx }))
		playlist = { ...playlist, items: reordered }

		// Persist new position for the moved item
		try {
			await fetch(`/api/playlists/${playlistId}/items/${moved.id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ position: toIdx })
			})
		} catch {
			// Best-effort — reload to restore consistent state
			loadPlaylist()
		}

		dragItemId = null
	}

	function onDragEnd() {
		dragItemId = null
		dragOverItemId = null
	}

	// ── Helpers ───────────────────────────────────────────────────────────────

	async function signIn() {
		await authClient.signIn.social({ provider: 'google', callbackURL: window.location.href })
	}
</script>

<div class="min-h-screen bg-bg">
	<TopBar hideBoardControls />

	<main class="mx-auto max-w-2xl px-4 py-8">

		<!-- Unauthenticated -->
		{#if !$session.isPending && !$session.data?.user}
			<div class="rounded-2xl border border-border bg-surface p-8 text-center">
				<h2 class="mb-2 text-lg font-semibold text-text">Sign in to view playlists</h2>
				<p class="mb-6 text-sm text-muted">You need to be signed in to access your playlists.</p>
				<button
					onclick={signIn}
					class="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-5 py-2.5 text-sm font-medium text-text transition hover:border-cyan-600/60 hover:bg-cyan-600/5"
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
			<div class="mb-6 h-8 w-48 animate-pulse rounded-xl bg-surface"></div>
			<div class="space-y-3">
				{#each [1, 2, 3] as i (i)}
					<div class="h-16 animate-pulse rounded-2xl border border-border bg-surface"></div>
				{/each}
			</div>

		<!-- Error -->
		{:else if error}
			<div class="rounded-2xl border border-red-500/30 bg-red-500/5 p-6 text-center">
				<p class="mb-4 text-sm text-red-400">{error}</p>
				<a href="/playlists" class="text-sm text-muted underline">Back to playlists</a>
			</div>

		{:else if playlist}
			<!-- Header -->
			<div class="mb-6 flex items-start gap-3">
				<!-- Back arrow -->
				<a
					href="/playlists"
					aria-label="Back to playlists"
					class="mt-1 flex size-8 shrink-0 items-center justify-center rounded-xl border border-border bg-surface text-muted transition hover:text-text"
				>
					<svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M19 12H5M12 5l-7 7 7 7" />
					</svg>
				</a>

				<!-- Playlist name / rename -->
				<div class="min-w-0 flex-1">
					{#if renaming}
						<div class="flex gap-2">
							<!-- svelte-ignore a11y_autofocus -->
							<input
								type="text"
								bind:value={renameName}
								onkeydown={onRenameKeydown}
								autofocus
								maxlength="80"
								class="min-w-0 flex-1 rounded-xl border border-cyan-600/60 bg-surface px-3 py-1.5 text-xl font-bold text-text focus:outline-none"
							/>
							<button
								onclick={saveRename}
								disabled={renameSaving}
								class="rounded-xl border border-cyan-600/50 bg-cyan-600/10 px-3 py-1.5 text-sm font-semibold text-cyan-400 disabled:opacity-50"
							>
								{renameSaving ? 'Saving…' : 'Save'}
							</button>
							<button
								onclick={cancelRename}
								class="rounded-xl border border-border px-3 py-1.5 text-sm text-muted"
							>
								Cancel
							</button>
						</div>
						{#if renameError}
							<p class="mt-1 text-xs text-red-400">{renameError}</p>
						{/if}
					{:else}
						<button
							onclick={startRename}
							title="Tap to rename"
							class="group flex items-center gap-2 text-left"
						>
							<h1 class="text-2xl font-bold text-text transition-colors group-hover:text-cyan-300">
								{playlist.name}
							</h1>
							<svg class="size-4 shrink-0 text-muted opacity-0 transition group-hover:opacity-100" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
								<path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
								<path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
							</svg>
						</button>
						<p class="mt-0.5 text-xs text-muted">
							{playlist.items.length} {playlist.items.length === 1 ? 'climb' : 'climbs'}
						</p>
					{/if}
				</div>

				<!-- Delete playlist -->
				{#if !deletingPlaylist}
					<button
						onclick={() => { deletingPlaylist = true }}
						aria-label="Delete playlist"
						class="mt-1 flex size-8 shrink-0 items-center justify-center rounded-xl border border-border bg-surface text-muted transition hover:border-red-500/40 hover:text-red-400"
					>
						<svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<polyline points="3 6 5 6 21 6" />
							<path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
							<path d="M10 11v6M14 11v6" />
							<path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
						</svg>
					</button>
				{:else}
					<div class="mt-1 flex items-center gap-2">
						<span class="text-xs text-muted">Delete playlist?</span>
						<button
							onclick={deletePlaylist}
							class="rounded-lg border border-red-500/40 bg-red-500/10 px-2.5 py-1 text-xs font-semibold text-red-400 transition hover:bg-red-500/20"
						>
							Yes, delete
						</button>
						<button
							onclick={() => { deletingPlaylist = false }}
							class="rounded-lg border border-border px-2.5 py-1 text-xs text-muted"
						>
							Cancel
						</button>
					</div>
				{/if}
			</div>

			<!-- Empty state -->
			{#if playlist.items.length === 0}
				<div class="rounded-2xl border border-border bg-surface p-8 text-center">
					<svg class="mx-auto mb-4 size-12 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
						<path d="M9 19V6l12-3v13" stroke-linecap="round" stroke-linejoin="round" />
						<circle cx="6" cy="19" r="3" />
						<circle cx="18" cy="16" r="3" />
					</svg>
					<h2 class="mb-2 text-lg font-semibold text-text">No climbs yet</h2>
					<p class="text-sm text-muted">
						Add climbs from the
						<a href="/" class="text-cyan-400 hover:underline">search page</a>.
					</p>
				</div>

			<!-- Item list -->
			{:else}
				<ul class="space-y-2">
					{#each playlist.items as item (item.id)}
						<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
						<li
							draggable={true}
							ondragstart={(e) => onDragStart(e, item.id)}
							ondragover={(e) => onDragOver(e, item.id)}
							ondragleave={onDragLeave}
							ondrop={(e) => onDrop(e, item.id)}
							ondragend={onDragEnd}
							class="group relative flex items-center gap-3 rounded-2xl border bg-surface p-3 transition {dragOverItemId === item.id && dragItemId !== item.id ? 'border-cyan-600/60 bg-cyan-600/5' : 'border-border'} {dragItemId === item.id ? 'opacity-40' : ''}"
						>
							<!-- Drag handle -->
							<div
								class="shrink-0 cursor-grab text-muted opacity-40 transition group-hover:opacity-100 active:cursor-grabbing"
								aria-hidden="true"
							>
								<svg class="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
									<circle cx="9" cy="6" r="1" fill="currentColor" stroke="none" />
									<circle cx="15" cy="6" r="1" fill="currentColor" stroke="none" />
									<circle cx="9" cy="12" r="1" fill="currentColor" stroke="none" />
									<circle cx="15" cy="12" r="1" fill="currentColor" stroke="none" />
									<circle cx="9" cy="18" r="1" fill="currentColor" stroke="none" />
									<circle cx="15" cy="18" r="1" fill="currentColor" stroke="none" />
								</svg>
							</div>

							<!-- Position number -->
							<span class="w-5 shrink-0 text-center text-xs font-semibold text-muted">
								{item.position + 1}
							</span>

							<!-- Climb link -->
							<a
								href="/climb/{item.climb_uuid}?playlist={playlistId}&pos={item.position}"
								class="min-w-0 flex-1 truncate text-sm font-medium text-text transition hover:text-cyan-300"
							>
								{item.climb_uuid}
							</a>

							<!-- Remove button -->
							<div class="relative z-10 shrink-0">
								{#if removingItemId === item.id}
									<div class="flex items-center gap-1.5">
										<span class="text-xs text-muted">Remove?</span>
										<button
											onclick={() => removeItem(item.id)}
											class="rounded-lg border border-red-500/40 bg-red-500/10 px-2 py-0.5 text-xs font-semibold text-red-400 hover:bg-red-500/20"
										>
											Yes
										</button>
										<button
											onclick={cancelRemoveItem}
											class="rounded-lg border border-border px-2 py-0.5 text-xs text-muted"
										>
											No
										</button>
									</div>
								{:else}
									<button
										onclick={() => confirmRemoveItem(item.id)}
										aria-label="Remove from playlist"
										class="flex size-7 items-center justify-center rounded-xl border border-border bg-surface-raised text-muted opacity-0 transition hover:border-red-500/40 hover:text-red-400 group-hover:opacity-100"
									>
										<svg class="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
											<path d="M18 6L6 18M6 6l12 12" />
										</svg>
									</button>
								{/if}
							</div>
						</li>
					{/each}
				</ul>

				<!-- Start session button -->
				<div class="mt-6">
					<a
						href="/climb/{playlist.items[0]?.climb_uuid}?playlist={playlistId}&pos=0"
						class="flex w-full items-center justify-center gap-2 rounded-2xl border border-cyan-600/50 bg-cyan-600/10 py-3 text-sm font-semibold text-cyan-400 transition hover:bg-cyan-600/20 active:scale-[0.99]"
					>
						<svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
							<polygon points="5 3 19 12 5 21 5 3" fill="currentColor" stroke="none" />
						</svg>
						Start session
					</a>
				</div>
			{/if}
		{/if}
	</main>
</div>
