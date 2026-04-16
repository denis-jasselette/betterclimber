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

import type { HoldToken, RoleId } from './types'
import { ROLE } from './types'

const FRAMES_RE = /p(\d+)r(\d+)/g

/** Parse a frames string into an array of hold tokens (frame 0 only). */
export function parseFrames(frames: string): HoldToken[] {
	// Multi-frame climbs separate frames with `,"` — only use frame 0.
	const frame0 = frames.split(',"')[0]
	const tokens: HoldToken[] = []
	FRAMES_RE.lastIndex = 0
	let match: RegExpExecArray | null
	// biome-ignore lint/suspicious/noAssignInExpressions: idiomatic regex exec loop
	while ((match = FRAMES_RE.exec(frame0)) !== null) {
		const placementId = parseInt(match[1], 10)
		const roleId = parseInt(match[2], 10) as RoleId
		tokens.push({ placementId, roleId })
	}
	return tokens
}

/** Returns true if the given roleId is a known role. */
export function isValidRole(roleId: number): roleId is RoleId {
	return Object.values(ROLE).includes(roleId as RoleId)
}
