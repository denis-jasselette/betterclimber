/**
 * Shared utilities for formatting session log data in the UI.
 */

export function formatSessionDate(
	iso: string,
	options: Intl.DateTimeFormatOptions = {
		weekday: 'short',
		month: 'short',
		day: 'numeric',
		year: 'numeric'
	}
): string {
	return new Date(iso).toLocaleDateString(undefined, options)
}

export function formatSessionTime(iso: string): string {
	return new Date(iso).toLocaleTimeString(undefined, {
		hour: '2-digit',
		minute: '2-digit'
	})
}

export function formatSessionDuration(startedAt: string, completedAt: string | null): string {
	if (!completedAt) return '—'
	const ms = new Date(completedAt).getTime() - new Date(startedAt).getTime()
	if (ms < 0) return '—'
	const totalMin = Math.round(ms / 60_000)
	if (totalMin < 60) return `${totalMin} min`
	const h = Math.floor(totalMin / 60)
	const m = totalMin % 60
	return m === 0 ? `${h}h` : `${h}h ${m}m`
}

export function rpeLabel(rpe: number): string {
	if (rpe <= 2) return 'Very easy'
	if (rpe <= 4) return 'Easy'
	if (rpe <= 6) return 'Moderate'
	if (rpe <= 8) return 'Hard'
	if (rpe === 9) return 'Very hard'
	return 'Maximal'
}

export function rpeColor(rpe: number): string {
	if (rpe <= 3) return 'text-emerald-400 bg-emerald-400/10 border-emerald-400/30'
	if (rpe <= 5) return 'text-cyan-400 bg-cyan-400/10 border-cyan-400/30'
	if (rpe <= 7) return 'text-amber-400 bg-amber-400/10 border-amber-400/30'
	return 'text-red-400 bg-red-400/10 border-red-400/30'
}

export function rpeTrackColor(rpe: number): string {
	if (rpe <= 3) return 'rgb(52 211 153)' // emerald-400
	if (rpe <= 6) return 'rgb(6 182 212)' // cyan-400
	if (rpe <= 8) return 'rgb(251 191 36)' // amber-400
	return 'rgb(248 113 113)' // red-400
}
