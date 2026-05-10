export async function apiCreatePlaylist(
	name: string
): Promise<{ id: string; name: string; created_at: string; item_count: number }> {
	const res = await fetch('/api/playlists', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ name })
	})
	if (!res.ok) throw new Error('Failed to create playlist')
	return res.json()
}
