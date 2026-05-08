import { describe, expect, it } from 'vitest'
import { parseFrames, resolveFrames } from './frames-parser'

describe('parseFrames', () => {
	it('single frame: parses all holds', () => {
		const result = parseFrames('p1083r15p1117r15p1164r12p1185r12')
		expect(result).toEqual([
			{ placementId: 1083, roleId: 15 },
			{ placementId: 1117, roleId: 15 },
			{ placementId: 1164, roleId: 12 },
			{ placementId: 1185, roleId: 12 }
		])
	})

	it('multi-frame: only parses frame 0', () => {
		// Frames separated by `,"` — only frame 0 is used
		const result = parseFrames('p1083r15,"p9999r13')
		expect(result).toEqual([{ placementId: 1083, roleId: 15 }])
	})

	it('empty string → empty array', () => {
		expect(parseFrames('')).toEqual([])
	})

	it('throws on invalid roleId', () => {
		expect(() => parseFrames('p1083r99')).toThrow('Invalid roleId: 99')
	})

	it('all valid roleIds are accepted (12, 13, 14, 15)', () => {
		const result = parseFrames('p1000r12p1001r13p1002r14p1003r15')
		expect(result.map((t) => t.roleId)).toEqual([12, 13, 14, 15])
	})
})

describe('resolveFrames', () => {
	it('resolves known placement IDs to hole + placement data', () => {
		// Placement 1073 → hole 1134 → LED 7 (from mock data)
		const result = resolveFrames('p1073r12')
		expect(result).toHaveLength(1)
		expect(result[0].placement.id).toBe(1073)
		expect(result[0].hole.id).toBe(1134)
		expect(result[0].roleId).toBe(12)
	})

	it('skips unknown placements silently (no throw)', () => {
		// Placement IDs < 1073 do not exist in mock data
		expect(() => resolveFrames('p100r12')).not.toThrow()
		expect(resolveFrames('p100r12')).toEqual([])
	})

	it('skips only the unknown hold, keeps valid ones', () => {
		const result = resolveFrames('p100r12p1073r13')
		expect(result).toHaveLength(1)
		expect(result[0].placement.id).toBe(1073)
	})

	it('empty frames string → empty array', () => {
		expect(resolveFrames('')).toEqual([])
	})
})
