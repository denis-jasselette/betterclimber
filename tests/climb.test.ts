import { expect, test } from '@playwright/test'
import { mockApiRoutes, TEST_UUID } from './support/mock-api'

test.beforeEach(async ({ page }) => {
	await mockApiRoutes(page)
})

test('climb detail page loads with title', async ({ page }) => {
	await page.goto(`/climb/${TEST_UUID}?angle=45`)
	await expect(page.getByRole('heading', { name: 'Floppy poppy' })).toBeVisible()
})

test('board visualisation SVG renders', async ({ page }) => {
	await page.goto(`/climb/${TEST_UUID}?angle=45`)
	await expect(page.getByRole('heading', { name: 'Floppy poppy' })).toBeVisible()
	await expect(page.locator('svg[aria-label="Kilter Board hold map"]')).toBeVisible()
})

test('BLE button is present in initial disconnected state', async ({ page }) => {
	await page.goto(`/climb/${TEST_UUID}?angle=45`)
	await expect(page.getByRole('heading', { name: 'Floppy poppy' })).toBeVisible()
	// "Light Up" button renders when Web Bluetooth is supported; otherwise shows unsupported notice.
	// Both are acceptable — BLE availability varies by browser/platform.
	const bleArea = page
		.getByRole('button', { name: 'Light Up' })
		.or(page.getByText('Web Bluetooth is not supported'))
	await expect(bleArea).toBeVisible()
})

test('prev and next navigation controls are present', async ({ page }) => {
	await page.goto(`/climb/${TEST_UUID}?angle=45`)
	await expect(page.getByRole('heading', { name: 'Floppy poppy' })).toBeVisible()
	// Prev/Next render as disabled spans when results store is empty
	await expect(page.getByText('Prev')).toBeVisible()
	await expect(page.getByText('Next')).toBeVisible()
})
