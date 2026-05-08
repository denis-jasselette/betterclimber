import { describe, expect, it } from 'vitest'
import { ALL_GRADES, difficultyToGrade, formatGrade, gradeToDifficulty } from './types'

describe('difficultyToGrade', () => {
	it('exact integer difficulty → correct grade', () => {
		expect(difficultyToGrade(1)).toBe('V0')
		expect(difficultyToGrade(16)).toBe('V1')
		expect(difficultyToGrade(32)).toBe('V17')
	})

	it('boundary: min difficulty (1) → V0', () => {
		expect(difficultyToGrade(1)).toBe('V0')
	})

	it('boundary: max difficulty (32) → V17', () => {
		expect(difficultyToGrade(32)).toBe('V17')
	})

	it('non-integer input: rounds to nearest', () => {
		// difficulty 16.4 rounds to 16 → V1
		expect(difficultyToGrade(16.4)).toBe('V1')
		// difficulty 16.6 rounds to 17 → V2
		expect(difficultyToGrade(16.6)).toBe('V2')
	})

	it('out-of-range: clamps to nearest', () => {
		// Below minimum — nearest is V0
		expect(difficultyToGrade(-10)).toBe('V0')
		// Above maximum — nearest is V17
		expect(difficultyToGrade(999)).toBe('V17')
	})
})

describe('gradeToDifficulty', () => {
	it('V0 → midpoint of its difficulty range', () => {
		// V0 spans difficulties 1–15 (15 entries), midpoint index 7 → difficulty 8
		expect(gradeToDifficulty('V0')).toBe(8)
	})

	it('single-entry grades map to their only difficulty', () => {
		expect(gradeToDifficulty('V1')).toBe(16)
		expect(gradeToDifficulty('V2')).toBe(17)
		expect(gradeToDifficulty('V17')).toBe(32)
	})

	it('unknown grade → 0', () => {
		expect(gradeToDifficulty('V99')).toBe(0)
	})

	it('roundtrip: difficultyToGrade(gradeToDifficulty(grade)) === grade for all grades', () => {
		for (const grade of ALL_GRADES) {
			expect(difficultyToGrade(gradeToDifficulty(grade))).toBe(grade)
		}
	})
})

describe('formatGrade', () => {
	it('v-scale: returns the grade unchanged', () => {
		expect(formatGrade('V5', 'v-scale')).toBe('V5')
		expect(formatGrade('V0', 'v-scale')).toBe('V0')
		expect(formatGrade('V17', 'v-scale')).toBe('V17')
	})

	it('french: maps V0 → 4', () => {
		expect(formatGrade('V0', 'french')).toBe('4')
	})

	it('french: maps V5 → 6C', () => {
		expect(formatGrade('V5', 'french')).toBe('6C')
	})

	it('french: maps V17 → 9A', () => {
		expect(formatGrade('V17', 'french')).toBe('9A')
	})

	it('french: unknown grade falls back to the input', () => {
		expect(formatGrade('V99', 'french')).toBe('V99')
	})
})
