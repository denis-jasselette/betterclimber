import { ALL_GRADES } from '$lib/data/types'
import type { GradingSystem, ThemePreference } from '$lib/settings-store.svelte'
import type { LayoutServerLoad } from './$types'

const VALID_GRADING: GradingSystem[] = ['v-scale', 'french']
const VALID_THEME: ThemePreference[] = ['dark', 'light', 'system']

export const load: LayoutServerLoad = ({ cookies }) => {
	let gradingSystem: GradingSystem = 'v-scale'
	let theme: ThemePreference = 'system'
	let flashGrade: string | null = null
	let projectGrade: string | null = null

	try {
		const raw = cookies.get('kilter-settings')
		if (raw) {
			const parsed = JSON.parse(decodeURIComponent(raw))
			if (VALID_GRADING.includes(parsed.gradingSystem)) gradingSystem = parsed.gradingSystem
			if (VALID_THEME.includes(parsed.theme)) theme = parsed.theme
			if (ALL_GRADES.includes(parsed.flashGrade)) flashGrade = parsed.flashGrade
			if (ALL_GRADES.includes(parsed.projectGrade)) projectGrade = parsed.projectGrade
		}
	} catch {
		// malformed cookie — fall back to defaults
	}

	return { settings: { gradingSystem, theme, flashGrade, projectGrade } }
}
