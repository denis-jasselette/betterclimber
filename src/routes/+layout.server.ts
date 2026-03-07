import type { LayoutServerLoad } from './$types';
import type { GradingSystem, ThemePreference } from '$lib/settings-store.svelte';

const VALID_GRADING: GradingSystem[] = ['v-scale', 'french'];
const VALID_THEME: ThemePreference[] = ['dark', 'light', 'system'];

export const load: LayoutServerLoad = ({ cookies }) => {
	let gradingSystem: GradingSystem = 'v-scale';
	let theme: ThemePreference = 'system';

	try {
		const raw = cookies.get('kilter-settings');
		if (raw) {
			const parsed = JSON.parse(decodeURIComponent(raw));
			if (VALID_GRADING.includes(parsed.gradingSystem)) gradingSystem = parsed.gradingSystem;
			if (VALID_THEME.includes(parsed.theme)) theme = parsed.theme;
		}
	} catch {
		// malformed cookie — fall back to defaults
	}

	return { settings: { gradingSystem, theme } };
};
