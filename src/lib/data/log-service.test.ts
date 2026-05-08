// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import {
	getEntry,
	getUuidsWhere,
	incrementAttempts,
	recordLitUp,
	resetAttempts,
	setLiked,
	setTicked
} from './log-service'

const UUID = 'test-climb-uuid'
const ANGLE = 40

afterEach(() => {
	localStorage.clear()
})

describe('getEntry', () => {
	it('missing key → EMPTY defaults', () => {
		expect(getEntry(UUID, ANGLE)).toEqual({ ticked: false, attemptCount: 0, liked: false })
	})

	it('null angle → EMPTY defaults (no localStorage access)', () => {
		expect(getEntry(UUID, null)).toEqual({ ticked: false, attemptCount: 0, liked: false })
	})
})

describe('setTicked', () => {
	it('persists ticked=true', () => {
		setTicked(UUID, ANGLE, true)
		expect(getEntry(UUID, ANGLE).ticked).toBe(true)
	})

	it('persists ticked=false', () => {
		setTicked(UUID, ANGLE, true)
		setTicked(UUID, ANGLE, false)
		expect(getEntry(UUID, ANGLE).ticked).toBe(false)
	})

	it('does not clobber other fields', () => {
		setLiked(UUID, ANGLE, true)
		setTicked(UUID, ANGLE, true)
		expect(getEntry(UUID, ANGLE).liked).toBe(true)
	})

	it('null angle is a no-op', () => {
		setTicked(UUID, null, true)
		expect(localStorage.length).toBe(0)
	})
})

describe('setLiked', () => {
	it('persists liked=true', () => {
		setLiked(UUID, ANGLE, true)
		expect(getEntry(UUID, ANGLE).liked).toBe(true)
	})

	it('does not clobber other fields', () => {
		setTicked(UUID, ANGLE, true)
		setLiked(UUID, ANGLE, true)
		expect(getEntry(UUID, ANGLE).ticked).toBe(true)
	})
})

describe('incrementAttempts', () => {
	it('count goes from 0 to 1', () => {
		incrementAttempts(UUID, ANGLE)
		expect(getEntry(UUID, ANGLE).attemptCount).toBe(1)
	})

	it('count increments on each call', () => {
		incrementAttempts(UUID, ANGLE)
		incrementAttempts(UUID, ANGLE)
		incrementAttempts(UUID, ANGLE)
		expect(getEntry(UUID, ANGLE).attemptCount).toBe(3)
	})

	it('does not clobber other fields', () => {
		setTicked(UUID, ANGLE, true)
		incrementAttempts(UUID, ANGLE)
		expect(getEntry(UUID, ANGLE).ticked).toBe(true)
	})
})

describe('resetAttempts', () => {
	it('resets count to 0', () => {
		incrementAttempts(UUID, ANGLE)
		incrementAttempts(UUID, ANGLE)
		resetAttempts(UUID, ANGLE)
		expect(getEntry(UUID, ANGLE).attemptCount).toBe(0)
	})

	it('does not clobber other fields', () => {
		setLiked(UUID, ANGLE, true)
		resetAttempts(UUID, ANGLE)
		expect(getEntry(UUID, ANGLE).liked).toBe(true)
	})
})

describe('recordLitUp', () => {
	it('sets lastLitAt to a recent ISO timestamp', () => {
		const before = Date.now()
		recordLitUp(UUID, ANGLE)
		const after = Date.now()
		const entry = getEntry(UUID, ANGLE)
		expect(entry.lastLitAt).toBeTruthy()
		// biome-ignore lint/style/noNonNullAssertion: checked by toBeTruthy() above
		const ts = new Date(entry.lastLitAt!).getTime()
		expect(ts).toBeGreaterThanOrEqual(before)
		expect(ts).toBeLessThanOrEqual(after)
	})

	it('does not clobber other fields', () => {
		setTicked(UUID, ANGLE, true)
		recordLitUp(UUID, ANGLE)
		expect(getEntry(UUID, ANGLE).ticked).toBe(true)
	})
})

describe('getUuidsWhere', () => {
	it('returns UUIDs matching the predicate at the given angle', () => {
		setTicked('uuid-a', ANGLE, true)
		setTicked('uuid-b', ANGLE, false)
		setTicked('uuid-c', ANGLE, true)
		const ticked = getUuidsWhere(ANGLE, (e) => e.ticked)
		expect(ticked).toEqual(new Set(['uuid-a', 'uuid-c']))
	})

	it('null angle → empty set', () => {
		setTicked(UUID, ANGLE, true)
		expect(getUuidsWhere(null, (e) => e.ticked)).toEqual(new Set())
	})

	it('angle-scoped: different angles are independent', () => {
		setTicked(UUID, 40, true)
		setTicked(UUID, 45, false)
		expect(getUuidsWhere(45, (e) => e.ticked)).toEqual(new Set())
		expect(getUuidsWhere(40, (e) => e.ticked)).toEqual(new Set([UUID]))
	})
})
