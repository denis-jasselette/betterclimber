/**
 * Client-side playlists store.
 *
 * Keeps an in-memory + localStorage cache of the user's playlists.
 * API calls are fire-and-forget for mutations; lists are fetched on demand.
 *
 * Storage key: `kb_playlists_v1` — array of Playlist (without items).
 */

import type { Playlist, PlaylistItem } from '$lib/data/types'

const STORAGE_KEY = 'kb_playlists_v1'

function loadFromStorage(): Playlist[] {
	if (typeof localStorage === 'undefined') return []
	try {
		const raw = localStorage.getItem(STORAGE_KEY)
		return raw ? (JSON.parse(raw) as Playlist[]) : []
	} catch {
		return []
	}
}

function saveToStorage(list: Playlist[]) {
	if (typeof localStorage === 'undefined') return
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(list))
	} catch {
		// Quota exceeded — ignore
	}
}

function createPlaylistsStore() {
	let playlists = $state<Playlist[]>(loadFromStorage())
	let loading = $state(false)

	/** True if a climb UUID is in any playlist (used for quick UI badge). */
	const climbPlaylistIds = $state<Map<string, Set<string>>>(new Map())

	async function fetchAll() {
		loading = true
		try {
			const res = await fetch('/api/playlists')
			if (!res.ok) return
			const data = (await res.json()) as Playlist[]
			playlists = data
			saveToStorage(data)
		} catch {
			// Use cache on error
		} finally {
			loading = false
		}
	}

	async function create(name: string): Promise<Playlist | null> {
		try {
			const res = await fetch('/api/playlists', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name })
			})
			if (!res.ok) return null
			const playlist = (await res.json()) as Playlist
			playlists = [...playlists, playlist]
			saveToStorage(playlists)
			return playlist
		} catch {
			return null
		}
	}

	async function rename(id: string, name: string): Promise<boolean> {
		try {
			const res = await fetch(`/api/playlists/${id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name })
			})
			if (!res.ok) return false
			playlists = playlists.map((p) => (p.id === id ? { ...p, name } : p))
			saveToStorage(playlists)
			return true
		} catch {
			return false
		}
	}

	async function remove(id: string): Promise<boolean> {
		try {
			const res = await fetch(`/api/playlists/${id}`, { method: 'DELETE' })
			if (!res.ok && res.status !== 204) return false
			playlists = playlists.filter((p) => p.id !== id)
			saveToStorage(playlists)
			return true
		} catch {
			return false
		}
	}

	async function addClimb(playlistId: string, climbUuid: string): Promise<PlaylistItem | null> {
		try {
			const res = await fetch(`/api/playlists/${playlistId}/items`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ climbUuid })
			})
			if (!res.ok) return null
			const item = (await res.json()) as PlaylistItem
			// Update item count in local cache
			playlists = playlists.map((p) =>
				p.id === playlistId ? { ...p, item_count: p.item_count + 1 } : p
			)
			saveToStorage(playlists)
			// Track which playlists this climb is in
			const set = climbPlaylistIds.get(climbUuid) ?? new Set<string>()
			set.add(playlistId)
			climbPlaylistIds.set(climbUuid, set)
			return item
		} catch {
			return null
		}
	}

	async function removeClimb(playlistId: string, climbUuid: string): Promise<boolean> {
		try {
			const res = await fetch(`/api/playlists/${playlistId}/items/${climbUuid}`, {
				method: 'DELETE'
			})
			if (!res.ok && res.status !== 204) return false
			playlists = playlists.map((p) =>
				p.id === playlistId ? { ...p, item_count: Math.max(0, p.item_count - 1) } : p
			)
			saveToStorage(playlists)
			const set = climbPlaylistIds.get(climbUuid)
			if (set) set.delete(playlistId)
			return true
		} catch {
			return false
		}
	}

	return {
		get list() {
			return playlists
		},
		get loading() {
			return loading
		},
		fetchAll,
		create,
		rename,
		remove,
		addClimb,
		removeClimb
	}
}

export const playlistsStore = createPlaylistsStore()
