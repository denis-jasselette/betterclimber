/**
 * better-auth client — Svelte reactive wrapper.
 *
 * Provides a reactive `authState` singleton with session info and
 * sign-in / sign-out helpers.
 *
 * baseURL must point to production so that the OAuth initiation request goes
 * through production's server. On deploy previews this is the production URL
 * (PUBLIC_BETTER_AUTH_URL), which enables the oAuthProxy plugin flow.
 * On production itself, PUBLIC_BETTER_AUTH_URL equals the current origin,
 * so the behaviour is identical to before.
 */

import { createAuthClient } from 'better-auth/svelte'
import { browser } from '$app/environment'
import { PUBLIC_BETTER_AUTH_URL } from '$env/static/public'

// Use PUBLIC_BETTER_AUTH_URL when set (enables oAuthProxy flow on deploy previews).
// Fall back to the current origin in the browser (or empty string on SSR) so that
// local dev and CI environments work without the variable being defined.
const authBase = PUBLIC_BETTER_AUTH_URL || (browser ? window.location.origin : '')

export const authClient = createAuthClient({
	baseURL: authBase
})
