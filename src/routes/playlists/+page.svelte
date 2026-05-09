<script lang="ts">
	import { goto } from '$app/navigation'
	import TopBar from '$lib/components/TopBar.svelte'
	import { playlistsStore } from '$lib/playlists-store.svelte'

	let showNew = $state(false)
	let newName = $state('')
	let creating = $state(false)
	let renamingId = $state<string | null>(null)
	let renameValue = $state('')
	let deletingId = $state<string | null>(null)

	$effect(() => {
		playlistsStore.fetchAll()
	})

	async function handleCreate() {
		const name = newName.trim()
		if (!name) return
		creating = true
		const playlist = await playlistsStore.create(name)
		creating = false
		if (playlist) {
			newName = ''
			showNew = false
		}
	}

	async function handleRename(id: string) {
		const name = renameValue.trim()
		if (!name) return
		await playlistsStore.rename(id, name)
		renamingId = null
	}

	async function handleDelete(id: string) {
		deletingId = id
		await playlistsStore.remove(id)
		deletingId = null
	}

	function startRename(id: string, currentName: string) {
		renamingId = id
		renameValue = currentName
	}
</script>

<svelte:head>
	<title>Playlists — Kilterboard</title>
</svelte:head>

<div class="min-h-screen bg-bg text-text">
	<TopBar angle={null} />

	<div class="mx-auto max-w-2xl px-4 py-6">
		<div class="mb-6 flex items-center justify-between">
			<div>
				<a href="/" class="text-sm text-muted transition hover:text-text">← Back</a>
				<h1 class="mt-2 text-2xl font-bold text-text">Playlists</h1>
			</div>
			<button
				onclick={() => (showNew = true)}
				class="flex items-center gap-2 rounded-xl border border-border bg-surface-raised px-4 py-2 text-sm font-semibold text-text transition hover:border-text"
			>
				<svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M12 5v14M5 12h14" />
				</svg>
				New
			</button>
		</div>

		{#if showNew}
			<div class="mb-4 rounded-2xl border border-border bg-surface p-4">
				<p class="mb-2 text-sm font-medium text-text">New playlist</p>
				<input
					type="text"
					bind:value={newName}
					placeholder="e.g. Tuesday session"
					class="w-full rounded-xl bg-surface-raised px-3 py-2.5 text-sm text-text placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-border"
					onkeydown={(e) => e.key === 'Enter' && handleCreate()}
					autofocus
				/>
				<div class="mt-3 flex gap-2">
					<button
						onclick={handleCreate}
						disabled={creating}
						class="flex-1 rounded-xl bg-text py-2.5 text-sm font-semibold text-bg transition hover:opacity-90 disabled:opacity-50"
					>
						{creating ? 'Creating…' : 'Create'}
					</button>
					<button
						onclick={() => {
							showNew = false
							newName = ''
						}}
						class="rounded-xl border border-border px-4 py-2.5 text-sm text-muted hover:text-text"
					>
						Cancel
					</button>
				</div>
			</div>
		{/if}

		{#if playlistsStore.loading && playlistsStore.list.length === 0}
			<div class="space-y-3">
				{#each [1, 2, 3] as n (n)}
					<div class="h-16 animate-pulse rounded-2xl bg-surface"></div>
				{/each}
			</div>
		{:else if playlistsStore.list.length === 0}
			<div class="py-16 text-center">
				<p class="text-muted">No playlists yet.</p>
				<p class="mt-1 text-sm text-muted">Create one and add climbs from the detail page.</p>
			</div>
		{:else}
			<div class="space-y-2">
				{#each playlistsStore.list as playlist (playlist.id)}
					<div class="rounded-2xl border border-border bg-surface">
						{#if renamingId === playlist.id}
							<div class="p-4">
								<input
									type="text"
									bind:value={renameValue}
									class="w-full rounded-xl bg-surface-raised px-3 py-2 text-sm text-text focus:outline-none focus:ring-1 focus:ring-border"
									onkeydown={(e) => {
										if (e.key === 'Enter') handleRename(playlist.id)
										if (e.key === 'Escape') renamingId = null
									}}
									autofocus
								/>
								<div class="mt-2 flex gap-2">
									<button
										onclick={() => handleRename(playlist.id)}
										class="flex-1 rounded-xl bg-text py-2 text-sm font-semibold text-bg hover:opacity-90"
									>
										Save
									</button>
									<button
										onclick={() => (renamingId = null)}
										class="rounded-xl border border-border px-3 py-2 text-sm text-muted hover:text-text"
									>
										Cancel
									</button>
								</div>
							</div>
						{:else}
							<div class="flex items-center justify-between px-4 py-3">
								<button
									onclick={() => goto(`/playlists/${playlist.id}`)}
									class="min-w-0 flex-1 text-left"
								>
									<div class="truncate text-sm font-semibold text-text">{playlist.name}</div>
									<div class="mt-0.5 text-xs text-muted">
										{playlist.item_count}
										{playlist.item_count === 1 ? 'climb' : 'climbs'}
									</div>
								</button>
								<div class="ml-2 flex items-center gap-1">
									<button
										onclick={() => startRename(playlist.id, playlist.name)}
										class="flex size-8 items-center justify-center rounded-lg text-muted hover:bg-surface-raised hover:text-text"
										title="Rename"
									>
										<svg
											class="size-4"
											viewBox="0 0 24 24"
											fill="none"
											stroke="currentColor"
											stroke-width="2"
										>
											<path
												d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"
											/>
											<path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
										</svg>
									</button>
									<button
										onclick={() => handleDelete(playlist.id)}
										disabled={deletingId === playlist.id}
										class="flex size-8 items-center justify-center rounded-lg text-muted hover:bg-red-500/10 hover:text-red-400 disabled:opacity-50"
										title="Delete"
									>
										{#if deletingId === playlist.id}
											<svg
												class="size-4 animate-spin"
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
												class="size-4"
												viewBox="0 0 24 24"
												fill="none"
												stroke="currentColor"
												stroke-width="2"
											>
												<polyline points="3 6 5 6 21 6" />
												<path
													d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"
												/>
												<path d="M10 11v6M14 11v6" />
												<path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
											</svg>
										{/if}
									</button>
									<button
										onclick={() => goto(`/playlists/${playlist.id}`)}
										class="flex size-8 items-center justify-center rounded-lg text-muted hover:bg-surface-raised hover:text-text"
										title="Open"
									>
										<svg
											class="size-4"
											viewBox="0 0 24 24"
											fill="none"
											stroke="currentColor"
											stroke-width="2"
										>
											<path d="M9 18l6-6-6-6" />
										</svg>
									</button>
								</div>
							</div>
						{/if}
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>
