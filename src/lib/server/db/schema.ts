/**
 * Drizzle ORM schema for the Kilter Board climb database on Neon PostgreSQL.
 *
 * Tables:
 *   climbs      — core climb data (318k rows from Aurora DB)
 *   climb_stats — per-angle community statistics (323k rows)
 *
 * Board geometry (placements, holes, leds) remains as static JSON in
 * src/lib/data/mock/ — it is tiny, never changes, and used only for BLE.
 */

import {
	boolean,
	doublePrecision,
	index,
	integer,
	pgTable,
	text,
	timestamp,
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

// ── Type inference helpers ────────────────────────────────────────────────────

export type ClimbRow = typeof climbs.$inferSelect
export type ClimbStatsRow = typeof climbStats.$inferSelect
