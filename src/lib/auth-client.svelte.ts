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
 *
 * $env/dynamic/public is used (not static) so the variable is read at runtime,
 * meaning an unset value during a deploy-preview build does not break the build.
 */

import { createAuthClient } from 'better-auth/svelte'
import { env } from '$env/dynamic/public'

export const authClient = createAuthClient({
	// Falls back to current origin so local dev and tests work without the var set
	baseURL:
		env.PUBLIC_BETTER_AUTH_URL || (typeof window !== 'undefined' ? window.location.origin : '')
})
