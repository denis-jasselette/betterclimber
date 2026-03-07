/**
 * Shared results store — holds the last search result list so the detail
 * page can resolve prev/next without re-running the query.
 *
 * Set by +page.svelte whenever results change; read by /climb/[uuid]/+page.svelte.
 */

import type { ClimbWithStats } from '$lib/data/types';

function createResultsStore() {
	let list = $state<ClimbWithStats[]>([]);

	return {
		get list() { return list; },
		set list(v: ClimbWithStats[]) { list = v; },

		indexOf(uuid: string): number {
			return list.findIndex((r) => r.climb.uuid === uuid);
		},

		prev(uuid: string): ClimbWithStats | null {
			const i = list.findIndex((r) => r.climb.uuid === uuid);
			return i > 0 ? list[i - 1] : null;
		},

		next(uuid: string): ClimbWithStats | null {
			const i = list.findIndex((r) => r.climb.uuid === uuid);
			return i !== -1 && i < list.length - 1 ? list[i + 1] : null;
		}
	};
}

export const resultsStore = createResultsStore();
