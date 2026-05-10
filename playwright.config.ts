import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
	testDir: './tests',
	retries: process.env.CI ? 1 : 0,
	use: {
		baseURL: 'http://localhost:5173'
	},
	projects: [
		{
			name: 'chromium',
			use: { ...devices['Desktop Chrome'] }
		}
	],
	webServer: {
		command: 'pnpm dev',
		port: 5173,
		reuseExistingServer: !process.env.CI,
		env: {
			DATABASE_URL: process.env.DATABASE_URL ?? 'postgresql://test:test@localhost/test'
		}
	}
})
