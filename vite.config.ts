import tailwindcss from '@tailwindcss/vite';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit(),
		VitePWA({
			registerType: 'autoUpdate',
			// Use generateSW strategy — vite-plugin-pwa generates the service worker
			strategies: 'generateSW',
			workbox: {
				// Cache all SvelteKit build assets
				globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,woff2}'],
				// Cache the app shell routes
				navigateFallback: '/',
				navigateFallbackDenylist: [/^\/api\//]
			},
			manifest: {
				name: 'Kilterboard Search',
				short_name: 'Kilterboard',
				description: 'Search and send Kilter Board climbs to your board',
				theme_color: '#0f172a',
				background_color: '#0f172a',
				display: 'standalone',
				orientation: 'portrait',
				scope: '/',
				start_url: '/',
				icons: [
					{
						src: '/icons/icon-192.png',
						sizes: '192x192',
						type: 'image/png',
						purpose: 'any maskable'
					},
					{
						src: '/icons/icon-512.png',
						sizes: '512x512',
						type: 'image/png',
						purpose: 'any maskable'
					}
				]
			},
			devOptions: {
				enabled: false
			}
		})
	]
});
