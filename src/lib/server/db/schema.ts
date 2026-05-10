/**
 * Drizzle ORM schema for the Kilter Board climb database on Neon PostgreSQL.
 *
 * Tables:
 *   climbs      — core climb data (318k rows from Aurora DB)
 *   climb_stats — per-angle community statistics (323k rows)
 *
 * Board geometry (placements, holes, leds) remains as static JSON in
 * src/lib/data/mock/ — it is tiny, never changes, and used only for BLE.
 *
 * JS property names for better-auth managed tables (users, sessions, accounts,
 * verifications) must be camelCase — better-auth's Drizzle adapter uses JS
 * property names, not SQL column names, when building queries.
 */

import {
	boolean,
	doublePrecision,
	index,
	integer,
	pgTable,
	text,
	timestamp,
	unique,
	varchar
} from 'drizzle-orm/pg-core'

// ── climbs ────────────────────────────────────────────────────────────────────

export const climbs = pgTable(
	'climbs',
	{
		uuid: varchar('uuid', { length: 36 }).primaryKey(),
		layout_id: integer('layout_id').notNull(),
		setter_id: integer('setter_id').notNull(),
		setter_username: text('setter_username').notNull(),
		name: text('name').notNull(),
		description: text('description').notNull().default(''),
		/** Encoded hold string, e.g. "p1083r15p1117r15..." */
		frames: text('frames').notNull(),
		frames_count: integer('frames_count').notNull().default(0),
		/** If set, designed for a specific angle; null = any angle. */
		angle: integer('angle'),
		is_draft: boolean('is_draft').notNull().default(false),
		allow_matches: boolean('allow_matches').notNull().default(true),
		is_campus: boolean('is_campus').notNull().default(false),
		created_at: timestamp('created_at', { withTimezone: true })
	},
	(t) => [
		// Text search indexes (ILIKE queries on name and setter_username)
		index('climbs_name_idx').on(t.name),
		index('climbs_setter_username_idx').on(t.setter_username),
		index('climbs_layout_id_idx').on(t.layout_id),
		index('climbs_is_draft_idx').on(t.is_draft)
	]
)

// ── climb_stats ───────────────────────────────────────────────────────────────

export const climbStats = pgTable(
	'climb_stats',
	{
		id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
		climb_uuid: varchar('climb_uuid', { length: 36 })
			.notNull()
			.references(() => climbs.uuid, { onDelete: 'cascade' }),
		angle: integer('angle').notNull(),
		difficulty_average: doublePrecision('difficulty_average').notNull().default(0),
		/** Null if not an official benchmark. */
		benchmark_difficulty: doublePrecision('benchmark_difficulty'),
		quality_average: doublePrecision('quality_average').notNull().default(0),
		ascent_count: integer('ascent_count').notNull().default(0),
		fa_username: text('fa_username'),
		fa_at: timestamp('fa_at', { withTimezone: true })
	},
	(t) => [
		index('climb_stats_climb_uuid_idx').on(t.climb_uuid),
		index('climb_stats_angle_idx').on(t.angle),
		index('climb_stats_quality_idx').on(t.quality_average),
		index('climb_stats_difficulty_idx').on(t.difficulty_average),
		// Composite index for the cursor-based pagination sort
		index('climb_stats_sort_idx').on(t.quality_average, t.ascent_count, t.climb_uuid)
	]
)

// ── users ─────────────────────────────────────────────────────────────────────
// JS property names are camelCase so better-auth's Drizzle adapter can map them.
// anonId is our custom field for anonymous user tracking.

export const users = pgTable('users', {
	id: text('id').primaryKey(),
	name: text('name'),
	email: text('email'),
	emailVerified: boolean('email_verified').notNull().default(false),
	image: text('image'),
	/** Our custom field: links anonymous sessions to this account. */
	anonId: text('anon_id').unique(),
	createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
	updatedAt: timestamp('updated_at', { withTimezone: true })
})

// ── user_log ──────────────────────────────────────────────────────────────────

export const userLog = pgTable(
	'user_log',
	{
		user_id: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		climb_uuid: varchar('climb_uuid', { length: 36 }).notNull(),
		angle: integer('angle').notNull(),
		ticked: boolean('ticked').notNull().default(false),
		/** Timestamp of the first tick (set once, never overwritten). */
		ticked_at: timestamp('ticked_at', { withTimezone: true }),
		attempt_count: integer('attempt_count').notNull().default(0),
		liked: boolean('liked').notNull().default(false),
		last_lit_at: timestamp('last_lit_at', { withTimezone: true }),
		updated_at: timestamp('updated_at', { withTimezone: true }).defaultNow()
	},
	(t) => [
		// Composite PK: one row per (user, climb, angle)
		{ primaryKey: [t.user_id, t.climb_uuid, t.angle] },
		index('user_log_user_id_angle_idx').on(t.user_id, t.angle)
	]
)

// ── better-auth managed tables ────────────────────────────────────────────────
// JS property names are camelCase so better-auth's Drizzle adapter can map them.
// SQL column names remain snake_case to match Neon conventions.

export const sessions = pgTable('sessions', {
	id: text('id').primaryKey(),
	expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
	token: text('token').notNull().unique(),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
	ipAddress: text('ip_address'),
	userAgent: text('user_agent'),
	userId: text('user_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' })
})

export const accounts = pgTable('accounts', {
	id: text('id').primaryKey(),
	accountId: text('account_id').notNull(),
	providerId: text('provider_id').notNull(),
	userId: text('user_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	accessToken: text('access_token'),
	refreshToken: text('refresh_token'),
	idToken: text('id_token'),
	accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
	refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }),
	scope: text('scope'),
	password: text('password'),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).notNull()
})

export const verifications = pgTable('verifications', {
	id: text('id').primaryKey(),
	identifier: text('identifier').notNull(),
	value: text('value').notNull(),
	expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
	createdAt: timestamp('created_at', { withTimezone: true }),
	updatedAt: timestamp('updated_at', { withTimezone: true })
})

// ── playlists ─────────────────────────────────────────────────────────────────

export const playlists = pgTable('playlists', {
	id: text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	user_id: text('user_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	name: text('name').notNull(),
	created_at: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
})

// ── playlist_items ────────────────────────────────────────────────────────────

export const playlistItems = pgTable(
	'playlist_items',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		playlist_id: text('playlist_id')
			.notNull()
			.references(() => playlists.id, { onDelete: 'cascade' }),
		climb_uuid: varchar('climb_uuid', { length: 36 })
			.notNull()
			.references(() => climbs.uuid, { onDelete: 'cascade' }),
		position: integer('position').notNull(),
		added_at: timestamp('added_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [unique('playlist_items_playlist_climb_uniq').on(t.playlist_id, t.climb_uuid)]
)

// ── Type inference helpers ────────────────────────────────────────────────────

export type ClimbRow = typeof climbs.$inferSelect
export type ClimbStatsRow = typeof climbStats.$inferSelect
export type UserRow = typeof users.$inferSelect
export type UserLogRow = typeof userLog.$inferSelect
export type PlaylistRow = typeof playlists.$inferSelect
export type PlaylistItemRow = typeof playlistItems.$inferSelect
