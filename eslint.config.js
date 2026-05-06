import tsParser from '@typescript-eslint/parser'
import sveltePlugin from 'eslint-plugin-svelte'
import svelteParser from 'svelte-eslint-parser'

export default [
	{
		ignores: ['.svelte-kit/**', 'build/**', '.netlify/**', '.claude/**', 'node_modules/**']
	},
	{
		// Silence stale eslint-disable comments for rules from plugins not loaded here.
		// Biome owns all general rules; ESLint is only here for Svelte 5 specifics.
		linterOptions: { reportUnusedDisableDirectives: 'off' }
	},
	{
		files: ['**/*.svelte'],
		plugins: { svelte: sveltePlugin },
		languageOptions: {
			parser: svelteParser,
			parserOptions: { parser: tsParser }
		},
		rules: {
			// Svelte 5: prefer $derived / $derived.by over $state + $effect for computed values
			'svelte/prefer-writable-derived': 'error',
			// Svelte 5: use $state / $derived runes instead of svelte/store primitives
			'no-restricted-imports': [
				'error',
				{
					paths: [
						{
							name: 'svelte/store',
							message: 'Use Svelte 5 runes ($state, $derived) instead of stores.'
						}
					]
				}
			]
		}
	}
]
