import { expect, test } from '@playwright/test'
import { mockApiRoutes } from './support/mock-api'

const STORAGE_KEY = 'kb_user_log_v2'

// Difficulty → V-grade mappings used in tests (from DIFFICULTY_GRADES in types.ts)
// 19 → V4, 20 → V5, 22 → V7

/** Seed localStorage with log entries before the page loads. */
async function seedLog(page: import('@playwright/test').Page, entries: Record<string, object>) {
	await page.addInitScript(
		({ key, data }) => {
			localStorage.setItem(key, JSON.stringify(data))
		},
		{ key: STORAGE_KEY, data: entries }
	)
}

const TODAY = new Date().toISOString()
const TWO_YEARS_AGO = new Date(new Date().setFullYear(new Date().getFullYear() - 2)).toISOString()

test.beforeEach(async ({ page }) => {
	await mockApiRoutes(page)
})

// ── Grade distribution ─────────────────────────────────────────────────────

test('grade distribution shows attempted-only bar when only lastAttemptAt is set', async ({
	page
}) => {
	// Entry with attempts but NO lastLitAt — the core bug scenario
	await seedLog(page, {
		'abc123@40': {
			ticked: false,
			attemptCount: 3,
			liked: false,
			difficulty: 20, // V5
			lastAttemptAt: TODAY,
			lastLitAt: null
		}
	})

	await page.goto('/stats')

	await expect(page.getByText('Grade distribution')).toBeVisible()
	// V5 bar row should be rendered (grade label is a span.font-semibold)
	await expect(page.locator('span.font-semibold', { hasText: 'V5' })).toBeVisible()
})

test('grade distribution: attempt-only entry survives switching to 1Y filter', async ({ page }) => {
	// Entry attempted today — no BLE light-up, so lastLitAt is absent
	await seedLog(page, {
		'abc123@40': {
			ticked: false,
			attemptCount: 2,
			liked: false,
			difficulty: 20, // V5
			lastAttemptAt: TODAY,
			lastLitAt: null
		}
	})

	await page.goto('/stats')

	// Visible under "All time"
	await expect(page.locator('span.font-semibold', { hasText: 'V5' })).toBeVisible()

	// Switch to 1Y — today's attempt is within range, bar must still appear
	await page.getByRole('button', { name: '1Y' }).click()
	await expect(page.locator('span.font-semibold', { hasText: 'V5' })).toBeVisible()

	// Switch to 3M
	await page.getByRole('button', { name: '3M' }).click()
	await expect(page.locator('span.font-semibold', { hasText: 'V5' })).toBeVisible()

	// Switch to 1M
	await page.getByRole('button', { name: '1M' }).click()
	await expect(page.locator('span.font-semibold', { hasText: 'V5' })).toBeVisible()
})

test('grade distribution: old attempts are excluded by date filter', async ({ page }) => {
	// Two entries: one old (2 years ago), one recent (today)
	await seedLog(page, {
		'old123@40': {
			ticked: false,
			attemptCount: 5,
			liked: false,
			difficulty: 19, // V4
			lastAttemptAt: TWO_YEARS_AGO,
			lastLitAt: null
		},
		'new456@40': {
			ticked: false,
			attemptCount: 1,
			liked: false,
			difficulty: 22, // V7
			lastAttemptAt: TODAY,
			lastLitAt: null
		}
	})

	await page.goto('/stats')

	// All time: both grades visible (V4 has its own bar, V7 also in range)
	await expect(page.locator('span.font-semibold', { hasText: 'V4' })).toBeVisible()
	await expect(page.locator('span.font-semibold', { hasText: 'V7' })).toBeVisible()

	// 1Y filter: old V4 entry (2 years ago) out of range — only V7 neighbourhood shown
	await page.getByRole('button', { name: '1Y' }).click()
	await expect(page.locator('span.font-semibold', { hasText: 'V4' })).not.toBeVisible()
	await expect(page.locator('span.font-semibold', { hasText: 'V7' })).toBeVisible()
})

test('grade distribution: ticked entry stays visible under date filter', async ({ page }) => {
	await seedLog(page, {
		'tick123@40': {
			ticked: true,
			attemptCount: 1,
			liked: false,
			difficulty: 20, // V5
			tickedAt: TODAY,
			lastAttemptAt: TODAY,
			lastLitAt: TODAY
		}
	})

	await page.goto('/stats')
	await page.getByRole('button', { name: '1M' }).click()
	await expect(page.locator('span.font-semibold', { hasText: 'V5' })).toBeVisible()
})

// ── Total attempts counter ────────────────────────────────────────────────

test('total attempts shows count when only lastAttemptAt is set', async ({ page }) => {
	await seedLog(page, {
		'abc123@40': {
			ticked: false,
			attemptCount: 7,
			liked: false,
			difficulty: 20,
			lastAttemptAt: TODAY,
			lastLitAt: null
		}
	})

	await page.goto('/stats')

	// Find the "Total attempts" summary card and check its value
	const card = page
		.locator('div.rounded-2xl')
		.filter({ has: page.locator('p', { hasText: 'Total attempts' }) })
	await expect(card.locator('p.text-cyan-400')).toHaveText('7')
})

test('total attempts does not vanish when switching to 1Y filter', async ({ page }) => {
	await seedLog(page, {
		'abc123@40': {
			ticked: false,
			attemptCount: 4,
			liked: false,
			difficulty: 20,
			lastAttemptAt: TODAY,
			lastLitAt: null
		}
	})

	await page.goto('/stats')
	await page.getByRole('button', { name: '1Y' }).click()

	const card = page
		.locator('div.rounded-2xl')
		.filter({ has: page.locator('p', { hasText: 'Total attempts' }) })
	await expect(card.locator('p.text-cyan-400')).toHaveText('4')
})
