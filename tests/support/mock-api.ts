import type { Page } from '@playwright/test'

export const TEST_UUID = 'FC1D03EC71D44A2CAE9B50A10D093560'

const baseClimb = {
	uuid: TEST_UUID,
	layout_id: 1,
	setter_id: 1078,
	setter_username: 'jwebxl',
	name: 'Floppy poppy',
	description: 'No matching',
	frames: 'p1182r12p1196r12p1254r13p1284r13p1372r14p1476r15',
	frames_count: 1,
	angle: 50,
	is_draft: false,
	allow_matches: true,
	is_campus: false,
	is_route: false
}

const baseStats = {
	climb_uuid: TEST_UUID,
	angle: 45,
	difficulty_average: 20,
	benchmark_difficulty: null,
	quality_average: 2.5,
	ascent_count: 42
}

export const testClimbWithStats = {
	climb: baseClimb,
	stats: [baseStats],
	activeStats: baseStats
}

function makeListItem(index: number) {
	const uuid = `${TEST_UUID.slice(0, -8)}0000000${index}`
	return {
		climb: { ...baseClimb, uuid, name: `Test Climb ${index + 1}` },
		stats: [{ ...baseStats, climb_uuid: uuid }],
		activeStats: { ...baseStats, climb_uuid: uuid }
	}
}

/**
 * Register Playwright route handlers that intercept /api/climbs requests
 * and return mock data, bypassing the Neon DB entirely.
 *
 * Must be called before page.goto().
 */
export async function mockApiRoutes(page: Page) {
	// Single climb — register first (more specific match)
	await page.route(`**/api/climbs/${TEST_UUID}**`, async (route) => {
		await route.fulfill({ json: testClimbWithStats })
	})
	// Climb list
	await page.route('**/api/climbs*', async (route) => {
		const climbs = Array.from({ length: 5 }, (_, i) => makeListItem(i))
		await route.fulfill({ json: { climbs, nextCursor: null } })
	})
}
