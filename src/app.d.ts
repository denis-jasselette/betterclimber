// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
import type { AuthUser, Session } from '$lib/server/auth'

declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			/** Anonymous UUID — always present (issued by hooks.server.ts). */
			anonId: string
			/** Authenticated user — null when no valid session. */
			user: AuthUser | null
			/** Active session — null when no valid session. */
			session: Session['session'] | null
		}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}
