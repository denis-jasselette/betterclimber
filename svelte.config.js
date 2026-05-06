import adapter from '@sveltejs/adapter-netlify'

/** @type {import('@sveltejs/kit').Config} */
const config = {
	experimental: { async: true },
	kit: {
		adapter: adapter({
			edge: false,
			split: false,
			output: 'build'
		})
	}
}

export default config
