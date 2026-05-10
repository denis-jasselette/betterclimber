import { createAuthClient } from 'better-auth/svelte'
import { browser } from '$app/environment'

export const authClient = createAuthClient({
	baseURL: browser ? window.location.origin : ''
})
