/**
 * Parses a climb's `frames` string into structured hold tokens.
 *
 * Format: "p{placementId}r{roleId}p{placementId}r{roleId}..."
 * Example: "p1083r15p1117r15p1164r12p1185r12p1233r13"
 */

import type { HoldToken, RoleId } from './types';
import { ROLE } from './types';

const FRAMES_RE = /p(\d+)r(\d+)/g;

/** Parse a frames string into an array of hold tokens. */
export function parseFrames(frames: string): HoldToken[] {
	const tokens: HoldToken[] = [];
	let match: RegExpExecArray | null;
	FRAMES_RE.lastIndex = 0;
	while ((match = FRAMES_RE.exec(frames)) !== null) {
		const placementId = parseInt(match[1], 10);
		const roleId = parseInt(match[2], 10) as RoleId;
		tokens.push({ placementId, roleId });
	}
	return tokens;
}

/** Returns true if the given roleId is a known role. */
export function isValidRole(roleId: number): roleId is RoleId {
	return Object.values(ROLE).includes(roleId as RoleId);
}
