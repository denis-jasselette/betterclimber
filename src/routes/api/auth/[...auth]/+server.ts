/**
 * Catch-all handler for better-auth routes.
 * All /api/auth/* requests are forwarded to the better-auth handler.
 * (Also handled in hooks.server.ts — this file satisfies SvelteKit's routing.)
 */

import { auth } from '$lib/server/auth'
import type { RequestHandler } from './$types'

export const GET: RequestHandler = ({ request }) => auth.handler(request)
export const POST: RequestHandler = ({ request }) => auth.handler(request)
