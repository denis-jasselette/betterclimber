/**
 * better-auth client — Svelte reactive wrapper.
 *
 * Provides a reactive `authState` singleton with session info and
 * sign-in / sign-out helpers.
 */

import { createAuthClient } from 'better-auth/svelte'
import { browser } from '$app/environment'

export const authClient = createAuthClient({
	baseURL: browser ? window.location.origin : ''
})

export type { Session } from 'better-auth'
