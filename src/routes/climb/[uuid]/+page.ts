import { getClimb } from '$lib/data/repository';
import { ALL_ANGLES } from '$lib/data/types';
import type { PageLoad } from './$types';

// Disable SSR — the page reads from localStorage (log-service) and the
// in-memory resultsStore, both of which are browser-only.
// The load function still runs on the client for every navigation, so
// the angle param is available immediately after hydration.
export const ssr = false;

export const load: PageLoad = async ({ params, url }) => {
	const raw = url.searchParams.get('angle');
	const angle = raw !== null && ALL_ANGLES.includes(Number(raw)) ? Number(raw) : null;

	// Pre-fetch the climb with the correct angle so stats are angle-aware
	// on first render (before the in-memory resultsStore is populated).
	const item = await getClimb(params.uuid, angle);

	return { item, angle };
};
