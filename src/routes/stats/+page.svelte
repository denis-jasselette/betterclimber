<script lang="ts">
	import { browser } from '$app/environment'
	import TopBar from '$lib/components/TopBar.svelte'
	import { getAllEntries } from '$lib/data/log-service'
	import { ALL_GRADES, difficultyToGrade, formatGrade } from '$lib/data/types'
	import { settings } from '$lib/settings-store.svelte'

	// ── Raw log data ─────────────────────────────────────────────────────────────
	const entries = $derived(browser ? getAllEntries() : [])

	// ── Summary counts ───────────────────────────────────────────────────────────
	const totalTicks = $derived(entries.filter((e) => e.entry.ticked).length)
	const totalAttempts = $derived(entries.reduce((sum, e) => sum + e.entry.attemptCount, 0))
	const totalLitUp = $derived(entries.filter((e) => e.entry.lastLitAt != null).length)

	// ── Activity heatmap (last 52 weeks, based on lastLitAt) ─────────────────────
	// Build a map of ISO date string → count of climbs lit up that day
	const activityByDay = $derived.by(() => {
		const map = new Map<string, number>()
		for (const { entry } of entries) {
			if (!entry.lastLitAt) continue
			const day = entry.lastLitAt.slice(0, 10) // "YYYY-MM-DD"
			map.set(day, (map.get(day) ?? 0) + 1)
		}
		return map
	})

	// Build the 52-week grid: array of 364 days ending today
	const heatmapDays = $derived.by(() => {
		const today = new Date()
		today.setHours(0, 0, 0, 0)
		// Start from the most recent Sunday going back 52 weeks
		const startOffset = today.getDay() // 0=Sun
		const gridStart = new Date(today)
		gridStart.setDate(today.getDate() - startOffset - 7 * 51)

		const days: Array<{ dateStr: string; count: number; inFuture: boolean }> = []
		const d = new Date(gridStart)
		for (let i = 0; i < 52 * 7; i++) {
			const dateStr = d.toISOString().slice(0, 10)
			days.push({
				dateStr,
				count: activityByDay.get(dateStr) ?? 0,
				inFuture: d > today
			})
			d.setDate(d.getDate() + 1)
		}
		return days
	})

	const maxDayCount = $derived(Math.max(1, ...heatmapDays.map((d) => d.count)))

	function heatColor(count: number, inFuture: boolean): string {
		if (inFuture || count === 0) return 'var(--color-surface)'
		const intensity = Math.min(count / Math.max(maxDayCount, 4), 1)
		if (intensity < 0.25) return 'rgb(6 182 212 / 0.25)'
		if (intensity < 0.5) return 'rgb(6 182 212 / 0.5)'
		if (intensity < 0.75) return 'rgb(6 182 212 / 0.75)'
		return 'rgb(6 182 212 / 1)'
	}

	// Month labels for the heatmap x-axis
	const monthLabels = $derived.by(() => {
		const labels: Array<{ label: string; col: number }> = []
		let lastMonth = -1
		heatmapDays.forEach((day, i) => {
			const col = Math.floor(i / 7)
			const month = new Date(`${day.dateStr}T00:00:00`).getMonth()
			if (month !== lastMonth) {
				labels.push({
					label: new Date(`${day.dateStr}T00:00:00`).toLocaleString('default', { month: 'short' }),
					col
				})
				lastMonth = month
			}
		})
		return labels
	})

	// ── Grade distribution ────────────────────────────────────────────────────────
	// Count ticks per V-grade (only entries that have difficulty stored)
	const gradeDistribution = $derived.by(() => {
		const counts = new Map<string, number>()
		for (const { entry } of entries) {
			if (!entry.ticked || entry.difficulty == null) continue
			const grade = difficultyToGrade(entry.difficulty)
			counts.set(grade, (counts.get(grade) ?? 0) + 1)
		}

		// Keep only grades that exist in the grade table, sorted
		return ALL_GRADES.map((g) => ({ grade: g, count: counts.get(g) ?? 0 })).filter(
			(_, i) => i <= ALL_GRADES.indexOf('V10') // V0–V10 range for display
		)
	})

	const maxGradeCount = $derived(Math.max(1, ...gradeDistribution.map((g) => g.count)))
	const hasGradeData = $derived(gradeDistribution.some((g) => g.count > 0))

	// ── Intensity over time (weekly attempts, last 12 weeks) ─────────────────────
	const weeklyActivity = $derived.by(() => {
		const today = new Date()
		today.setHours(0, 0, 0, 0)
		// Build 12 weeks ending this week
		const weeks: Array<{ label: string; litUp: number; ticks: number }> = []
		for (let w = 11; w >= 0; w--) {
			const weekStart = new Date(today)
			weekStart.setDate(today.getDate() - today.getDay() - w * 7)
			const weekEnd = new Date(weekStart)
			weekEnd.setDate(weekStart.getDate() + 7)

			const startStr = weekStart.toISOString().slice(0, 10)
			const endStr = weekEnd.toISOString().slice(0, 10)

			let litUp = 0
			let ticks = 0
			for (const { entry } of entries) {
				if (entry.lastLitAt) {
					const d = entry.lastLitAt.slice(0, 10)
					if (d >= startStr && d < endStr) litUp++
				}
				if (entry.ticked && entry.tickedAt) {
					const d = entry.tickedAt.slice(0, 10)
					if (d >= startStr && d < endStr) ticks++
				}
			}

			weeks.push({
				label: weekStart.toLocaleString('default', { month: 'short', day: 'numeric' }),
				litUp,
				ticks
			})
		}
		return weeks
	})

	const maxWeeklyCount = $derived(Math.max(1, ...weeklyActivity.map((w) => w.litUp + w.ticks)))
</script>

<svelte:head>
	<title>Stats — Kilterboard</title>
</svelte:head>

<div class="min-h-screen bg-bg text-text">
	<TopBar />

	<main class="mx-auto max-w-4xl px-4 py-8">
		<h1 class="mb-8 text-2xl font-bold">Training Stats</h1>

		<!-- Summary cards -->
		<div class="mb-10 grid grid-cols-3 gap-4">
			<div class="rounded-2xl border border-border bg-surface p-4 text-center">
				<p class="text-3xl font-bold text-cyan-400">{totalTicks}</p>
				<p class="mt-1 text-sm text-muted">Sends</p>
			</div>
			<div class="rounded-2xl border border-border bg-surface p-4 text-center">
				<p class="text-3xl font-bold text-cyan-400">{totalAttempts}</p>
				<p class="mt-1 text-sm text-muted">Attempts</p>
			</div>
			<div class="rounded-2xl border border-border bg-surface p-4 text-center">
				<p class="text-3xl font-bold text-cyan-400">{totalLitUp}</p>
				<p class="mt-1 text-sm text-muted">Problems Tried</p>
			</div>
		</div>

		<!-- Activity heatmap -->
		<section class="mb-10">
			<h2 class="mb-4 text-lg font-semibold">Activity</h2>
			<div class="rounded-2xl border border-border bg-surface p-4 overflow-x-auto">
				{#if activityByDay.size === 0}
					<p class="text-sm text-muted py-4 text-center">
						No activity yet. Light up a climb on the board to start tracking.
					</p>
				{:else}
					<div class="relative" style="min-width: 640px;">
						<!-- Month labels -->
						<div class="mb-1 flex h-4 text-xs text-muted" style="padding-left: 1.5rem;">
							{#each monthLabels as { label, col } (col)}
								<span
									class="absolute text-xs text-muted"
									style="left: calc(1.5rem + {col} * 14px)"
								>{label}</span>
							{/each}
						</div>

						<div class="flex gap-0.5" style="padding-left: 1.5rem;">
							{#each { length: 52 } as _, col (col)}
								<div class="flex flex-col gap-0.5">
									{#each { length: 7 } as _, row (row)}
										{@const day = heatmapDays[col * 7 + row]}
										{#if day}
											<div
												class="size-3 rounded-sm"
												style="background-color: {heatColor(day.count, day.inFuture)};"
												title="{day.dateStr}: {day.count} climb{day.count === 1 ? '' : 's'}"
											></div>
										{/if}
									{/each}
								</div>
							{/each}
						</div>

						<!-- Day-of-week labels -->
						<div
							class="absolute left-0 top-5 flex flex-col gap-0.5 text-xs text-muted"
							style="line-height: 12px;"
						>
							<span class="h-3"></span>
							<span class="h-3">M</span>
							<span class="h-3"></span>
							<span class="h-3">W</span>
							<span class="h-3"></span>
							<span class="h-3">F</span>
							<span class="h-3"></span>
						</div>
					</div>

					<!-- Legend -->
					<div class="mt-3 flex items-center gap-2 text-xs text-muted justify-end">
						<span>Less</span>
						{#each [0, 1, 2, 3] as level (level)}
							<div
								class="size-3 rounded-sm"
								style="background-color: {heatColor(level, false)};"
							></div>
						{/each}
						<span>More</span>
					</div>
				{/if}
			</div>
		</section>

		<!-- Weekly intensity (last 12 weeks) -->
		<section class="mb-10">
			<h2 class="mb-4 text-lg font-semibold">Weekly Intensity</h2>
			<div class="rounded-2xl border border-border bg-surface p-4">
				{#if weeklyActivity.every((w) => w.litUp === 0 && w.ticks === 0)}
					<p class="text-sm text-muted py-4 text-center">No data yet.</p>
				{:else}
					<div class="flex items-end gap-1.5 h-32">
						{#each weeklyActivity as week (week.label)}
							<div class="flex flex-col items-center gap-0.5 flex-1">
								<!-- Ticks on top (cyan) -->
								{#if week.ticks > 0}
									<div
										class="w-full rounded-t bg-cyan-400"
										style="height: {(week.ticks / maxWeeklyCount) * 7}rem;"
										title="{week.ticks} sends"
									></div>
								{/if}
								<!-- Attempts (surface lighter) -->
								{#if week.litUp > 0}
									<div
										class="w-full {week.ticks === 0 ? 'rounded' : 'rounded-b'} bg-cyan-400/30"
										style="height: {(week.litUp / maxWeeklyCount) * 7}rem;"
										title="{week.litUp} problems lit"
									></div>
								{/if}
								{#if week.litUp === 0 && week.ticks === 0}
									<div class="w-full rounded bg-border/50" style="height: 2px;"></div>
								{/if}
							</div>
						{/each}
					</div>
					<!-- X axis labels — show first and last -->
					<div class="mt-2 flex justify-between text-xs text-muted px-0.5">
						<span>{weeklyActivity[0]?.label}</span>
						<span>{weeklyActivity[weeklyActivity.length - 1]?.label}</span>
					</div>
					<div class="mt-3 flex items-center gap-4 text-xs text-muted">
						<span class="flex items-center gap-1.5">
							<span class="inline-block size-2.5 rounded-sm bg-cyan-400"></span> Sends
						</span>
						<span class="flex items-center gap-1.5">
							<span class="inline-block size-2.5 rounded-sm bg-cyan-400/30"></span> Problems lit
						</span>
					</div>
				{/if}
			</div>
		</section>

		<!-- Grade distribution -->
		<section class="mb-10">
			<h2 class="mb-4 text-lg font-semibold">Grade Pyramid</h2>
			<div class="rounded-2xl border border-border bg-surface p-4">
				{#if !hasGradeData}
					<p class="text-sm text-muted py-4 text-center">
						No grade data yet. Send a climb to start building your pyramid.
					</p>
				{:else}
					<div class="space-y-1.5">
						{#each gradeDistribution.toReversed() as { grade, count } (grade)}
							<div class="flex items-center gap-3">
								<span class="w-8 text-right text-xs font-mono text-muted shrink-0">
									{formatGrade(grade, settings.gradingSystem)}
								</span>
								<div class="flex-1 rounded bg-border/30 overflow-hidden h-5">
									{#if count > 0}
										<div
											class="h-full rounded bg-cyan-400/80 flex items-center justify-end pr-2 transition-all"
											style="width: {(count / maxGradeCount) * 100}%;"
										>
											<span class="text-xs font-semibold text-bg">{count}</span>
										</div>
									{/if}
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		</section>
	</main>
</div>
