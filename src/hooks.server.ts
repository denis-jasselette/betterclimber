/**
 * SvelteKit server hooks.
 *
 * Responsibilities:
 *  1. Issue an anonymous UUID cookie (kb_anon_id) on every request where it is absent.
 *  2. Validate the better-auth session cookie and inject locals.user (null if unauthed).
 *  3. Forward all /api/auth/* requests to the better-auth handler.
 */

import type { Handle } from '@sveltejs/kit'
import { sequence } from '@sveltejs/kit/hooks'
import { auth } from '$lib/server/auth'

const ANON_COOKIE = 'kb_anon_id'
const ANON_MAX_AGE = 60 * 60 * 24 * 365 * 2 // 2 years

/** Issue / persist the anonymous ID cookie. */
const anonCookieHandle: Handle = async ({ event, resolve }) => {
	let anonId = event.cookies.get(ANON_COOKIE)
	if (!anonId) {
		anonId = crypto.randomUUID()
		event.cookies.set(ANON_COOKIE, anonId, {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			maxAge: ANON_MAX_AGE,
			secure: event.url.protocol === 'https:'
		})
	}
	event.locals.anonId = anonId
	return resolve(event)
}

/** Validate better-auth session and inject locals.user. */
const authHandle: Handle = async ({ event, resolve }) => {
	// Delegate /api/auth/* to better-auth
	if (event.url.pathname.startsWith('/api/auth')) {
		return auth.handler(event.request)
	}

	try {
		const session = await auth.api.getSession({ headers: event.request.headers })
		event.locals.user = session?.user ?? null
		event.locals.session = session?.session ?? null
	} catch {
		event.locals.user = null
		event.locals.session = null
	}

	return resolve(event)
}

export const handle = sequence(anonCookieHandle, authHandle)
