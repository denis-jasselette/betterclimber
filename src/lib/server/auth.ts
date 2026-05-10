/**
 * better-auth configuration.
 *
 * Google OAuth provider. Uses the existing Neon PostgreSQL database.
 * Better-auth manages its own sessions/accounts/verifications tables.
 *
 * Required environment variables:
 *   BETTER_AUTH_SECRET   — min 32 chars (openssl rand -base64 32)
 *   BETTER_AUTH_URL      — production base URL, e.g. https://betterclimber.netlify.app
 *                          Use the same value in all environments (deploy previews
 *                          route OAuth through production via the oAuthProxy plugin).
 *   GOOGLE_CLIENT_ID     — from Google Cloud Console
 *   GOOGLE_CLIENT_SECRET — from Google Cloud Console
 */

import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { oAuthProxy } from 'better-auth/plugins'
import {
	BETTER_AUTH_SECRET,
	BETTER_AUTH_URL,
	GOOGLE_CLIENT_ID,
	GOOGLE_CLIENT_SECRET
} from '$env/static/private'
import { db } from '$lib/server/db'
import * as schema from '$lib/server/db/schema'

export const auth = betterAuth({
	secret: BETTER_AUTH_SECRET,
	baseURL: BETTER_AUTH_URL,
	// Allow Netlify deploy-preview origins so that the oAuthProxy plugin can
	// redirect back to the preview after completing the OAuth flow on production.
	trustedOrigins: ['https://*.netlify.app'],
	plugins: [
		// Enables OAuth sign-in from Netlify deploy previews.
		// Flow: preview → production handles Google callback → encrypts profile →
		// redirects to preview → preview decrypts using shared BETTER_AUTH_SECRET →
		// preview creates its own session cookie. No cross-domain cookie issue.
		oAuthProxy()
	],
	database: drizzleAdapter(db, {
		provider: 'pg',
		schema: {
			user: schema.users,
			session: schema.sessions,
			account: schema.accounts,
			verification: schema.verifications
		},
		// better-auth uses camelCase field names; map to our snake_case columns
		usePlural: false
	}),
	socialProviders: {
		google: {
			clientId: GOOGLE_CLIENT_ID,
			clientSecret: GOOGLE_CLIENT_SECRET
		}
	},
	// Keep sessions in DB so we can look them up server-side
	session: {
		storeSessionInDatabase: true,
		cookieCache: {
			enabled: true,
			maxAge: 60 * 60 * 24 * 30 // 30 days
		}
	},
	user: {
		// Map better-auth's default "user" model to our "users" table
		modelName: 'user'
	}
})

export type Session = typeof auth.$Infer.Session
export type AuthUser = typeof auth.$Infer.Session.user
