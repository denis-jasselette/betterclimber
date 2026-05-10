<script lang="ts">
	/**
	 * PlaylistPicker — Add/remove a climb from the user's playlists.
	 *
	 * On mobile: renders as a bottom sheet (full-width, slides up from bottom).
	 * On desktop: renders as a popover anchored below the trigger button.
	 *
	 * Props:
	 *   climbUuid — UUID of the climb being acted on.
	 *   isAuthenticated — whether the current user is signed in.
	 *   onclose — called when the picker should close.
	 */

	import { authClient } from '$lib/auth-client.svelte'

	let {
		climbUuid,
		onclose
	}: {
		climbUuid: string
		onclose: () => void
	} = $props()

	// ── Auth ──────────────────────────────────────────────────────────────────────
	const session = authClient.useSession()
	const isAuthenticated = $derived(!!$session.data?.user)

	// ── Playlist state ────────────────────────────────────────────────────────────
	type PlaylistRow = { id: string; name: string; item_count: number }
	type ItemMembership = Record<string, string | null> // playlistId → itemId | null

	let playlists = $state<PlaylistRow[]>([])
	let membership = $state<ItemMembership>({}) // which playlists contain this climb
	let loading = $state(true)
	let error = $state<string | null>(null)

	// New playlist creation
	let creatingNew = $state(false)
	let newName = $state('')
	let savingNew = $state(false)

	// Busy per playlist (optimistic toggle in flight)
	let busy = $state<Record<string, boolean>>({})

	// ── Load playlists on mount ───────────────────────────────────────────────────
	$effect(() => {
		if (!isAuthenticated) return
		loadPlaylists()
	})

	async function loadPlaylists() {
		loading = true
		error = null
		try {
			const listRes = await fetch('/api/playlists')
			if (!listRes.ok) throw new Error('Failed to load playlists')
			const list: PlaylistRow[] = await listRes.json()
			playlists = list

			// Build membership map: which playlists already contain this climb?
			// Fetch each playlist's items in parallel to find the itemId for this climb.
			const membershipMap: ItemMembership = {}
			for (const pl of list) {
				membershipMap[pl.id] = null
			}
			await Promise.all(
				list.map(async (pl) => {
					const r = await fetch(`/api/playlists/${pl.id}`)
					if (!r.ok) return
					const data: { items: { id: string; climb_uuid: string }[] } = await r.json()
					const found = data.items.find((i) => i.climb_uuid === climbUuid)
					membershipMap[pl.id] = found ? found.id : null
				})
			)
			membership = membershipMap
		} catch (e) {
			error = e instanceof Error ? e.message : 'Something went wrong'
		} finally {
			loading = false
		}
	}

	// ── Toggle a playlist (add or remove) ────────────────────────────────────────
	async function togglePlaylist(playlistId: string) {
		if (busy[playlistId]) return
		busy = { ...busy, [playlistId]: true }

		const currentItemId = membership[playlistId]
		// Optimistic update
		if (currentItemId) {
			// Remove
			membership = { ...membership, [playlistId]: null }
			playlists = playlists.map((p) =>
				p.id === playlistId ? { ...p, item_count: Math.max(0, p.item_count - 1) } : p
			)
		} else {
			// Add — we don't know the itemId yet; use a placeholder
			membership = { ...membership, [playlistId]: '__pending__' }
			playlists = playlists.map((p) =>
				p.id === playlistId ? { ...p, item_count: p.item_count + 1 } : p
			)
		}

		try {
			if (currentItemId) {
				// DELETE
				const res = await fetch(`/api/playlists/${playlistId}/items/${currentItemId}`, {
					method: 'DELETE'
				})
				if (!res.ok) throw new Error('Failed to remove from playlist')
			} else {
				// POST
				const res = await fetch(`/api/playlists/${playlistId}/items`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ climb_uuid: climbUuid })
				})
				if (!res.ok) {
					// Could be a 409 conflict (already in playlist) — treat as success
					if (res.status === 409) {
						// Already added — re-fetch to get real itemId
						const r = await fetch(`/api/playlists/${playlistId}`)
						if (r.ok) {
							const data: { items: { id: string; climb_uuid: string }[] } = await r.json()
							const found = data.items.find((i) => i.climb_uuid === climbUuid)
							membership = { ...membership, [playlistId]: found ? found.id : null }
						}
						return
					}
					throw new Error('Failed to add to playlist')
				}
				const item: { id: string } = await res.json()
				membership = { ...membership, [playlistId]: item.id }
			}
		} catch {
			// Rollback optimistic update
			membership = { ...membership, [playlistId]: currentItemId ?? null }
			playlists = playlists.map((p) => {
				if (p.id !== playlistId) return p
				return {
					...p,
					item_count: currentItemId
						? p.item_count + 1 // we decremented, restore
						: Math.max(0, p.item_count - 1) // we incremented, restore
				}
			})
		} finally {
			busy = { ...busy, [playlistId]: false }
		}
	}

	// ── Create new playlist ───────────────────────────────────────────────────────
	async function createPlaylist() {
		const trimmed = newName.trim()
		if (!trimmed || savingNew) return
		savingNew = true
		try {
			const res = await fetch('/api/playlists', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name: trimmed })
			})
			if (!res.ok) throw new Error('Failed to create playlist')
			const created: PlaylistRow = await res.json()

			// Optimistically add to list, then immediately add the climb
			playlists = [...playlists, { ...created, item_count: 0 }]
			membership = { ...membership, [created.id]: null }
			newName = ''
			creatingNew = false

			await togglePlaylist(created.id)
		} catch {
			// ignore — user can retry
		} finally {
			savingNew = false
		}
	}

	// ── Keyboard: close on Escape ─────────────────────────────────────────────────
	function onKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') onclose()
	}
</script>

<svelte:window onkeydown={onKeydown} />

<!-- Backdrop (covers the page; click outside closes) -->
<div
	class="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm sm:flex sm:items-start sm:justify-center sm:pt-[20vh]"
	role="presentation"
	onclick={(e) => {
		if (e.target === e.currentTarget) onclose()
	}}
	onkeydown={undefined}
>
	<!-- Sheet / popover panel -->
	<div
		class="fixed bottom-0 left-0 right-0 z-50 max-h-[80vh] rounded-t-2xl border-t border-border bg-bg shadow-2xl sm:relative sm:bottom-auto sm:left-auto sm:right-auto sm:w-[360px] sm:rounded-2xl sm:border"
		role="dialog"
		aria-modal="true"
		aria-label="Add to playlist"
	>
		<!-- Drag handle (mobile only) -->
		<div class="flex justify-center py-2 sm:hidden">
			<div class="h-1 w-10 rounded-full bg-border"></div>
		</div>

		<!-- Header -->
		<div class="flex items-center justify-between border-b border-border px-4 py-3">
			<h2 class="text-sm font-semibold text-text">Add to playlist</h2>
			<button
				onclick={onclose}
				class="rounded-lg p-1.5 text-muted transition hover:text-text active:scale-95"
				aria-label="Close"
			>
				<svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M18 6 6 18M6 6l12 12" />
				</svg>
			</button>
		</div>

		<!-- Body -->
		<div class="overflow-y-auto px-2 py-2" style="max-height: calc(80vh - 60px)">
			{#if !isAuthenticated}
				<!-- Unauthenticated state -->
				<div class="px-4 py-6 text-center">
					<p class="mb-4 text-sm text-muted">Sign in to save climbs to playlists.</p>
					<a
						href="/auth/sign-in"
						class="inline-flex items-center gap-2 rounded-xl border border-border bg-surface-raised px-4 py-2.5 text-sm font-semibold text-text transition hover:border-cyan-600/60 hover:bg-cyan-600/5 active:scale-95"
					>
						Sign in
					</a>
				</div>
			{:else if loading}
				<div class="space-y-2 px-2 py-3">
					{#each [1, 2, 3] as n (n)}
						<div class="h-10 animate-pulse rounded-xl bg-surface"></div>
					{/each}
				</div>
			{:else if error}
				<div class="px-4 py-4 text-center">
					<p class="mb-3 text-sm text-red-400">{error}</p>
					<button
						onclick={loadPlaylists}
						class="rounded-xl border border-border px-3 py-1.5 text-sm text-muted transition hover:text-text"
					>
						Retry
					</button>
				</div>
			{:else}
				<!-- Playlist rows -->
				{#each playlists as pl (pl.id)}
					{@const inPlaylist = !!membership[pl.id]}
					{@const isBusy = !!busy[pl.id]}
					<button
						onclick={() => togglePlaylist(pl.id)}
						disabled={isBusy}
						class="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-surface active:scale-[0.98] disabled:opacity-60"
					>
						<div class="min-w-0">
							<p class="truncate text-sm font-medium text-text">{pl.name}</p>
							<p class="text-xs text-muted">{pl.item_count} climbs</p>
						</div>
						<div
							class="flex size-6 shrink-0 items-center justify-center rounded-full transition {inPlaylist
								? 'bg-cyan-500 text-white'
								: 'border border-border text-transparent'}"
						>
							{#if isBusy}
								<svg
									class="size-3.5 animate-spin text-muted"
									xmlns="http://www.w3.org/2000/svg"
									fill="none"
									viewBox="0 0 24 24"
								>
									<circle
										class="opacity-25"
										cx="12"
										cy="12"
										r="10"
										stroke="currentColor"
										stroke-width="4"
									></circle>
									<path
										class="opacity-75"
										fill="currentColor"
										d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
									></path>
								</svg>
							{:else if inPlaylist}
								<svg
									class="size-3.5"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									stroke-width="2.5"
								>
									<path d="M5 13l4 4L19 7" />
								</svg>
							{/if}
						</div>
					</button>
				{/each}

				<!-- New playlist row -->
				{#if creatingNew}
					<form
						onsubmit={(e) => {
							e.preventDefault()
							createPlaylist()
						}}
						class="flex items-center gap-2 px-3 py-2"
					>
						<!-- svelte-ignore a11y_autofocus -->
						<input
							autofocus
							type="text"
							placeholder="Playlist name"
							bind:value={newName}
							maxlength="80"
							class="min-w-0 flex-1 rounded-lg border border-border bg-surface-raised px-3 py-1.5 text-sm text-text placeholder:text-muted focus:border-cyan-600 focus:outline-none"
						/>
						<button
							type="submit"
							disabled={savingNew || newName.trim().length === 0}
							class="rounded-lg border border-cyan-600 bg-cyan-600/10 px-3 py-1.5 text-xs font-semibold text-cyan-300 transition hover:bg-cyan-600/20 active:scale-95 disabled:opacity-50"
						>
							{savingNew ? '…' : 'Save'}
						</button>
						<button
							type="button"
							onclick={() => {
								creatingNew = false
								newName = ''
							}}
							class="rounded-lg border border-border px-3 py-1.5 text-xs text-muted transition hover:text-text active:scale-95"
						>
							Cancel
						</button>
					</form>
				{:else}
					<button
						onclick={() => (creatingNew = true)}
						class="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-surface active:scale-[0.98]"
					>
						<div
							class="flex size-6 shrink-0 items-center justify-center rounded-full border border-dashed border-border"
						>
							<svg
								class="size-3 text-muted"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2.5"
							>
								<path d="M12 5v14M5 12h14" />
							</svg>
						</div>
						<span class="text-sm text-muted">New playlist</span>
					</button>
				{/if}
			{/if}
		</div>
	</div>
</div>
