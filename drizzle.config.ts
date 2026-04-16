import { defineConfig } from 'drizzle-kit'

export default defineConfig({
	schema: './src/lib/server/db/schema.ts',
	out: './drizzle',
	dialect: 'postgresql',
	dbCredentials: {
		// biome-ignore lint/style/noNonNullAssertion: set in .env, required for migrations
		url: process.env.DATABASE_URL!
	},
	verbose: true,
	strict: true
})
