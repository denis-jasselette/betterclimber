/**
 * Server-side helpers for session templates.
 * Used by both the REST API (/api/sessions) and the SSR page loads (/sessions).
 */

import { eq, inArray, sql } from 'drizzle-orm'
import { db } from '$lib/server/db'
import { sessionBlocks, sessionExercises, sessionTemplates } from '$lib/server/db/schema'

// ── Types ─────────────────────────────────────────────────────────────────────

export type SessionExercise = {
	id: string
	block_id: string
	position: number
	name: string
	description: string | null
	type: string
	series_count: number
	rest_s: number
	reps: number | null
	duration_s: number | null
	grade_ref: string | null
	climb_count: number | null
	duration_per_climb_s: number | null
	rest_between_climbs_s: number | null
}

export type SessionBlock = {
	id: string
	template_id: string
	position: number
	name: string
	description: string | null
	exercises: SessionExercise[]
}

export type SessionTemplateDetail = {
	id: string
	name: string
	description: string | null
	is_public: boolean
	author_id: string | null
	created_at: Date | null
	blocks: SessionBlock[]
}

export type SessionTemplateSummary = {
	id: string
	name: string
	description: string | null
	created_at: Date | null
	block_count: number
}

// ── Queries ───────────────────────────────────────────────────────────────────

/** Returns all public templates with block counts ordered by creation date. */
export async function listPublicTemplates(): Promise<SessionTemplateSummary[]> {
	return db
		.select({
			id: sessionTemplates.id,
			name: sessionTemplates.name,
			description: sessionTemplates.description,
			created_at: sessionTemplates.created_at,
			block_count: sql<number>`(
				select count(*)::int
				from ${sessionBlocks}
				where ${sessionBlocks.template_id} = ${sessionTemplates.id}
			)`
		})
		.from(sessionTemplates)
		.where(eq(sessionTemplates.is_public, true))
		.orderBy(sessionTemplates.created_at)
}

/** Returns a full template with blocks and exercises, or null if not found. */
export async function getTemplateDetail(id: string): Promise<SessionTemplateDetail | null> {
	const templateRows = await db
		.select()
		.from(sessionTemplates)
		.where(eq(sessionTemplates.id, id))
		.limit(1)

	if (templateRows.length === 0) return null

	const blocks = await db
		.select()
		.from(sessionBlocks)
		.where(eq(sessionBlocks.template_id, id))
		.orderBy(sessionBlocks.position)

	const blockIds = blocks.map((b) => b.id)

	const exercises =
		blockIds.length > 0
			? await db
					.select()
					.from(sessionExercises)
					.where(inArray(sessionExercises.block_id, blockIds))
					.orderBy(sessionExercises.block_id, sessionExercises.position)
			: []

	const exercisesByBlock = new Map<string, SessionExercise[]>()
	for (const ex of exercises) {
		const arr = exercisesByBlock.get(ex.block_id) ?? []
		arr.push(ex)
		exercisesByBlock.set(ex.block_id, arr)
	}

	return {
		...templateRows[0],
		blocks: blocks.map((block) => ({
			...block,
			exercises: exercisesByBlock.get(block.id) ?? []
		}))
	}
}
