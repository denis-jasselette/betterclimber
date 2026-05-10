/**
 * GET /api/sessions/[id] — full template with blocks and exercises.
 */

import { error, json } from '@sveltejs/kit'
import { eq, inArray } from 'drizzle-orm'
import { db } from '$lib/server/db'
import { sessionBlocks, sessionExercises, sessionTemplates } from '$lib/server/db/schema'
import type { RequestHandler } from './$types'

export const GET: RequestHandler = async ({ params }) => {
	const { id } = params

	const templateRows = await db
		.select()
		.from(sessionTemplates)
		.where(eq(sessionTemplates.id, id))
		.limit(1)

	if (templateRows.length === 0) {
		error(404, 'Session template not found')
	}

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

	// Group exercises by block
	const exercisesByBlock = new Map<string, typeof exercises>()
	for (const ex of exercises) {
		const arr = exercisesByBlock.get(ex.block_id) ?? []
		arr.push(ex)
		exercisesByBlock.set(ex.block_id, arr)
	}

	const result = {
		...templateRows[0],
		blocks: blocks.map((block) => ({
			...block,
			exercises: exercisesByBlock.get(block.id) ?? []
		}))
	}

	return json(result)
}
