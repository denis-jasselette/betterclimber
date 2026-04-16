import { expect, test } from '@playwright/test'

test('settings page loads with heading', async ({ page }) => {
	await page.goto('/settings')
	await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()
})

test('theme options are visible', async ({ page }) => {
	await page.goto('/settings')
	await expect(page.getByRole('button', { name: /System/ })).toBeVisible()
	await expect(page.getByRole('button', { name: /Dark/ })).toBeVisible()
	await expect(page.getByRole('button', { name: /Light/ })).toBeVisible()
})
