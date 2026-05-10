/**
 * better-auth client — Svelte reactive wrapper.
 *
 * Provides a reactive `authState` singleton with session info and
 * sign-in / sign-out helpers.
 *
 * baseURL always points to the production auth server (PUBLIC_BETTER_AUTH_URL)
 * so that OAuth flows work correctly on Netlify deploy previews, which are not
 * registered in the Google OAuth app. Deploy previews redirect through
 * production auth and receive the session cookie from the production domain.
 */

import { createAuthClient } from 'better-auth/svelte'
import { PUBLIC_BETTER_AUTH_URL } from '$env/static/public'

export const authClient = createAuthClient({
	baseURL: PUBLIC_BETTER_AUTH_URL || (typeof window !== 'undefined' ? window.location.origin : '')
})
