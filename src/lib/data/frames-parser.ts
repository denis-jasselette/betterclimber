/**
 * Parses a climb's `frames` string into structured hold tokens.
 *
 * Single-frame format: "p{placementId}r{roleId}p{placementId}r{roleId}..."
 * Example: "p1083r15p1117r15p1164r12p1185r12p1233r13"
 *
 * Multi-frame format: frames separated by `,"` — each frame after the first
 * is a delta (p = add/update hold, x = remove hold). Only frame 0 is parsed
 * here because it contains the complete hold set; subsequent frames are
 * move-sequence deltas used for beta videos.
 */

import { getHoleById } from '$lib/data/mock/holes'
import { getPlacementById } from '$lib/data/mock/placements'
import type { HoldToken } from './types'
import { isRoleId } from './types'

/** Parse a frames string into an array of hold tokens (frame 0 only). */
export function parseFrames(frames: string): HoldToken[] {
	// Multi-frame climbs separate frames with `,"` — only use frame 0.
	return parseFrame(frames.split(',"')[0])
}

function parseFrame(frame: string): HoldToken[] {
	const re = /p(?<placement>\d+)r(?<role>\d+)/g
	return [...frame.matchAll(re)].map(({ groups }) => {
		if (!groups) throw new Error('Unreachable case')
		const placementId = Number(groups.placement)
		const roleId = Number(groups.role)

		if (!isRoleId(roleId)) throw new Error(`Invalid roleId: ${roleId}`)

		return { placementId, roleId }
	})
}

export function resolveFrames(frames: string) {
	return parseFrames(frames).map((token) => {
		const placement = getPlacementById(token.placementId)
		if (!placement) throw new Error(`Unknown placement ${token.placementId}`)
		const hole = getHoleById(placement.hole_id)
		if (!hole) throw new Error(`Unknown hole ${placement.hole_id}`)

		return {
			placement,
			hole,
			roleId: token.roleId
		}
	})
}
