import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
	resolve: {
		alias: {
			$lib: resolve('./src/lib')
		}
	},
	test: {
		environment: 'node',
		include: ['src/**/*.test.ts']
	}
})
