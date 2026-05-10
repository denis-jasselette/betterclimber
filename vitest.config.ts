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
		include: ['src/**/*.test.ts'],
		coverage: {
			provider: 'v8',
			reporter: ['text', 'lcov', 'json-summary', 'json'],
			reportsDirectory: './coverage',
			reportOnFailure: true,
			exclude: ['src/lib/data/mock/**', '*.config.*', '**/*.d.ts', '.svelte-kit/**', 'scripts/**'],
			thresholds: {
				statements: 85,
				branches: 80,
				functions: 90,
				lines: 90
			}
		}
	}
})
