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
 *                          are added to trustedOrigins below so auth still works).
 *   GOOGLE_CLIENT_ID     — from Google Cloud Console
 *   GOOGLE_CLIENT_SECRET — from Google Cloud Console
 */

import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
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
	// Allow Netlify deploy-preview origins so that the OAuth flow works on
	// preview deployments without registering each URL in Google Cloud Console.
	// Auth callbacks go through production (BETTER_AUTH_URL); only the final
	// redirect back to the app is from the deploy-preview origin.
	trustedOrigins: ['https://*.netlify.app'],
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
