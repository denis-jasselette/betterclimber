/**
 * Shared results store — holds the last search result list so the detail
 * page can resolve prev/next without re-running the query.
 *
 * Set by +page.svelte whenever results change; read by /climb/[uuid]/+page.svelte.
 */

import type { ClimbWithStats } from '$lib/data/types'

const STORAGE_KEY = 'kilter-results'

function loadFromSession(): ClimbWithStats[] {
	if (typeof sessionStorage === 'undefined') return []
	try {
		const raw = sessionStorage.getItem(STORAGE_KEY)
		return raw ? (JSON.parse(raw) as ClimbWithStats[]) : []
	} catch {
		return []
	}
}

function saveToSession(list: ClimbWithStats[]) {
	if (typeof sessionStorage === 'undefined') return
	try {
		sessionStorage.setItem(STORAGE_KEY, JSON.stringify(list))
	} catch {
		// Quota exceeded — silently ignore; prev/next just won't work after refresh
	}
}

function createResultsStore() {
	let list = $state<ClimbWithStats[]>(loadFromSession())

	return {
		get list() {
			return list
		},
		set list(v: ClimbWithStats[]) {
			list = v
			saveToSession(v)
		},

		indexOf(uuid: string): number {
			return list.findIndex((r) => r.climb.uuid === uuid)
		},

		prev(uuid: string): ClimbWithStats | null {
			const i = list.findIndex((r) => r.climb.uuid === uuid)
			return i > 0 ? list[i - 1] : null
		},

		next(uuid: string): ClimbWithStats | null {
			const i = list.findIndex((r) => r.climb.uuid === uuid)
			return i !== -1 && i < list.length - 1 ? list[i + 1] : null
		}
	}
}

export const resultsStore = createResultsStore()
