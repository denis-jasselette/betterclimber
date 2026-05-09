<script lang="ts">
	import { playlistsStore } from '$lib/playlists-store.svelte'

	interface Props {
		climbUuid: string
		onclose?: () => void
	}

	let { climbUuid, onclose }: Props = $props()

	let newName = $state('')
	let creating = $state(false)
	let addingTo = $state<string | null>(null)
	let added = $state<Set<string>>(new Set())
	let showNewForm = $state(false)
	let error = $state('')

	// Fetch playlists when the panel opens (one-time, no reactive deps)
	playlistsStore.fetchAll()

	async function handleAdd(playlistId: string) {
		if (added.has(playlistId)) return
		addingTo = playlistId
		const item = await playlistsStore.addClimb(playlistId, climbUuid)
		if (item) {
			added = new Set([...added, playlistId])
		}
		addingTo = null
	}

	async function handleCreate() {
		const name = newName.trim()
		if (!name) {
			error = 'Enter a playlist name'
			return
		}
		creating = true
		error = ''
		const playlist = await playlistsStore.create(name)
		if (playlist) {
			newName = ''
			showNewForm = false
			// Immediately add the climb to the new playlist
			await handleAdd(playlist.id)
		} else {
			error = 'Failed to create playlist'
		}
		creating = false
	}
</script>

<!-- Backdrop -->
<div
	class="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
	role="button"
	tabindex="-1"
	aria-label="Close"
	onclick={onclose}
	onkeydown={(e) => e.key === 'Escape' && onclose?.()}
></div>

<!-- Panel -->
<div
	class="fixed bottom-0 left-0 right-0 z-50 max-h-[80vh] overflow-y-auto rounded-t-2xl border-t border-border bg-bg shadow-2xl"
>
	<div class="sticky top-0 flex items-center justify-between border-b border-border bg-bg px-4 py-3">
		<h2 class="text-sm font-semibold text-text">Add to playlist</h2>
		<button
			onclick={onclose}
			class="flex size-7 items-center justify-center rounded-full text-muted hover:text-text"
			aria-label="Close"
		>
			<svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<path d="M18 6L6 18M6 6l12 12" />
			</svg>
		</button>
	</div>

	<div class="space-y-1 p-3">
		{#if playlistsStore.loading && playlistsStore.list.length === 0}
			<div class="py-4 text-center text-sm text-muted">Loading…</div>
		{:else if playlistsStore.list.length === 0 && !showNewForm}
			<div class="py-4 text-center text-sm text-muted">No playlists yet</div>
		{:else}
			{#each playlistsStore.list as playlist (playlist.id)}
				<button
					onclick={() => handleAdd(playlist.id)}
					disabled={addingTo === playlist.id}
					class="flex w-full items-center justify-between rounded-xl px-4 py-3 text-left transition hover:bg-surface-raised disabled:opacity-50"
				>
					<div>
						<div class="text-sm font-medium text-text">{playlist.name}</div>
						<div class="text-xs text-muted">{playlist.item_count} climbs</div>
					</div>
					{#if added.has(playlist.id)}
						<svg
							class="size-5 text-green-400"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2.5"
						>
							<path d="M5 13l4 4L19 7" />
						</svg>
					{:else if addingTo === playlist.id}
						<svg
							class="size-4 animate-spin text-muted"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
						>
							<circle cx="12" cy="12" r="10" class="opacity-25" />
							<path class="opacity-75" d="M4 12a8 8 0 018-8V0" />
						</svg>
					{:else}
						<svg
							class="size-5 text-muted"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
						>
							<path d="M12 5v14M5 12h14" />
						</svg>
					{/if}
				</button>
			{/each}
		{/if}

		<!-- New playlist form -->
		{#if showNewForm}
			<div class="rounded-xl border border-border bg-surface p-3">
				<input
					type="text"
					bind:value={newName}
					placeholder="Playlist name"
					class="w-full rounded-lg bg-surface-raised px-3 py-2 text-sm text-text placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-border"
					onkeydown={(e) => e.key === 'Enter' && handleCreate()}
					autofocus
				/>
				{#if error}
					<p class="mt-1 text-xs text-red-400">{error}</p>
				{/if}
				<div class="mt-2 flex gap-2">
					<button
						onclick={handleCreate}
						disabled={creating}
						class="flex-1 rounded-lg bg-text py-2 text-sm font-semibold text-bg transition hover:opacity-90 disabled:opacity-50"
					>
						{creating ? 'Creating…' : 'Create'}
					</button>
					<button
						onclick={() => {
							showNewForm = false
							error = ''
							newName = ''
						}}
						class="rounded-lg border border-border px-3 py-2 text-sm text-muted hover:text-text"
					>
						Cancel
					</button>
				</div>
			</div>
		{:else}
			<button
				onclick={() => (showNewForm = true)}
				class="flex w-full items-center gap-3 rounded-xl border border-dashed border-border px-4 py-3 text-sm text-muted transition hover:border-text hover:text-text"
			>
				<svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M12 5v14M5 12h14" />
				</svg>
				New playlist
			</button>
		{/if}
	</div>
</div>
