import { expect, test } from '@playwright/test'
import { mockApiRoutes } from './support/mock-api'

test.beforeEach(async ({ page }) => {
	await mockApiRoutes(page)
})

test('home page loads with climb results', async ({ page }) => {
	await page.goto('/?angle=45')
	await expect(page.locator('article').first()).toBeVisible()
})

test('angle in URL is reflected in dropdown display', async ({ page }) => {
	await page.goto('/?angle=40')
	await expect(page.locator('article').first()).toBeVisible()
	await expect(page.locator('[data-dropdown] > button')).toContainText('40°')
})

test('navigate to climb from card link', async ({ page }) => {
	await page.goto('/?angle=45')
	await expect(page.locator('article').first()).toBeVisible()
	// Click the first climb card link
	await page.locator('article').first().locator('a').first().click()
	// Should land on a /climb/ page
	await expect(page).toHaveURL(/\/climb\//)
})

test('text search input accepts a query without breaking results', async ({ page }) => {
	await page.goto('/?angle=45')
	await expect(page.locator('article').first()).toBeVisible()

	await page.getByPlaceholder('Search by name or setter…').fill('slab')
	// Results section still present (mock returns same data regardless of query)
	await expect(page.locator('article').first()).toBeVisible()
})

test('filter sidebar shows search input', async ({ page }) => {
	await page.goto('/?angle=45')
	await expect(page.getByPlaceholder('Search by name or setter…')).toBeVisible()
})

test('advanced filter section opens and shows campus/route toggles', async ({ page }) => {
	await page.goto('/?angle=45')
	// Open the Advanced details section
	await page.getByText('Advanced').click()
	await expect(page.getByRole('button', { name: 'Campus only' })).toBeVisible()
	await expect(page.getByRole('button', { name: 'Routes only' })).toBeVisible()
})
