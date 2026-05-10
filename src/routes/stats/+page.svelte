<script lang="ts">
	import { browser } from '$app/environment'
	import TopBar from '$lib/components/TopBar.svelte'
	import {
		type DateRange,
		type DayActivity,
		type GradeCount,
		getActivityByDay,
		getActivityByWeek,
		getGradeDistribution,
		getPersonalBests,
		getTotalAttempts,
		getTotalClimbsLit,
		getTotalTicks,
		type PersonalBests,
		type WeekActivity
	} from '$lib/data/log-stats'
	import { ALL_GRADES, formatGrade } from '$lib/data/types'
	import { settings } from '$lib/settings-store.svelte'

	// ── Time range filter ─────────────────────────────────────────────────────
	type RangePreset = 'all' | '1y' | '3m' | '1m' | 'custom'
	let rangePreset = $state<RangePreset>('all')
	let customFrom = $state('')
	let customTo = $state('')

	const PRESETS: { key: RangePreset; label: string }[] = [
		{ key: 'all', label: 'All time' },
		{ key: '1y', label: '1Y' },
		{ key: '3m', label: '3M' },
		{ key: '1m', label: '1M' },
		{ key: 'custom', label: 'Custom' }
	]

	const effectiveRange = $derived.by((): DateRange | undefined => {
		if (rangePreset === 'all') return undefined
		if (rangePreset === 'custom') {
			const from = customFrom ? new Date(`${customFrom}T00:00:00`) : undefined
			const to = customTo ? new Date(`${customTo}T23:59:59`) : undefined
			return { from, to }
		}
		const days = rangePreset === '1y' ? 365 : rangePreset === '3m' ? 90 : 30
		const from = new Date()
		from.setDate(from.getDate() - days)
		from.setHours(0, 0, 0, 0)
		const to = new Date()
		to.setHours(23, 59, 59, 999)
		return { from, to }
	})

	// ── Data ──────────────────────────────────────────────────────────────────
	const dailyActivity = $derived<DayActivity[]>(browser ? getActivityByDay(effectiveRange) : [])
	const weeklyActivity = $derived<WeekActivity[]>(browser ? getActivityByWeek(effectiveRange) : [])
	const gradeDistribution = $derived<GradeCount[]>(
		browser ? getGradeDistribution(effectiveRange) : []
	)
	const totalTicks = $derived(browser ? getTotalTicks(effectiveRange) : 0)
	const totalClimbsLit = $derived(browser ? getTotalClimbsLit(effectiveRange) : 0)
	const totalAttempts = $derived(browser ? getTotalAttempts(effectiveRange) : 0)
	const personalBests = $derived<PersonalBests>(
		browser
			? getPersonalBests(effectiveRange)
			: { highestTick: null, highestFlash: null, avgAttemptsPerDay: null }
	)

	// ── Heatmap (GitHub-style calendar) ───────────────────────────────────────
	// Arrange days into weeks (Mon–Sun columns)
	const CELL = 12
	const GAP = 2
	const CELL_STRIDE = CELL + GAP

	const heatmapWeeks = $derived.by(() => {
		if (dailyActivity.length === 0) return []
		// Group into 7-day weeks starting from the first Monday on or before the first day
		const weeks: DayActivity[][] = []
		let week: DayActivity[] = []
		for (const day of dailyActivity) {
			const dow = new Date(`${day.date}T00:00:00`).getDay() // 0=Sun,1=Mon...
			const col = dow === 0 ? 6 : dow - 1 // 0=Mon … 6=Sun
			if (week.length === 0 && col !== 0) {
				// Pad first partial week with nulls represented as zero-count days
				for (let i = 0; i < col; i++) {
					week.push({ date: '', climbCount: 0, tickCount: 0 })
				}
			}
			week.push(day)
			if (week.length === 7) {
				weeks.push(week)
				week = []
			}
		}
		if (week.length > 0) weeks.push(week)
		return weeks
	})

	const heatmapMax = $derived(Math.max(1, ...dailyActivity.map((d) => d.climbCount)))

	function heatmapColor(count: number): string {
		if (count === 0) return 'var(--color-surface)'
		const ratio = count / heatmapMax
		if (ratio < 0.25) return 'rgb(8 145 178 / 0.3)' // cyan-600 faint
		if (ratio < 0.5) return 'rgb(8 145 178 / 0.55)'
		if (ratio < 0.75) return 'rgb(6 182 212 / 0.75)' // cyan-500
		return 'rgb(6 182 212)'
	}

	const heatmapWidth = $derived(heatmapWeeks.length * CELL_STRIDE)
	const heatmapHeight = 7 * CELL_STRIDE

	// Month labels for heatmap
	const heatmapMonthLabels = $derived.by(() => {
		const labels: { x: number; label: string }[] = []
		let lastMonth = -1
		heatmapWeeks.forEach((week, wi) => {
			const firstReal = week.find((d) => d.date !== '')
			if (!firstReal) return
			const m = new Date(`${firstReal.date}T00:00:00`).getMonth()
			if (m !== lastMonth) {
				labels.push({
					x: wi * CELL_STRIDE,
					label: new Date(`${firstReal.date}T00:00:00`).toLocaleString('default', {
						month: 'short'
					})
				})
				lastMonth = m
			}
		})
		return labels
	})

	// ── Weekly intensity bar chart ─────────────────────────────────────────────
	const BAR_W = 8
	const BAR_GAP = 3
	const CHART_H = 80

	const weekMax = $derived(Math.max(1, ...weeklyActivity.map((w) => w.climbCount)))
	const barChartWidth = $derived(weeklyActivity.length * (BAR_W + BAR_GAP))

	// ── Grade distribution ─────────────────────────────────────────────────────
	const gradeMax = $derived(
		Math.max(1, ...gradeDistribution.map((g) => g.ticked + g.attemptedOnly))
	)
	// Only show grades in the active range (padded by 1 on each side)
	const gradesToShow = $derived.by(() => {
		const withActivity = gradeDistribution.filter((g) => g.ticked + g.attemptedOnly > 0)
		if (withActivity.length === 0) return []
		const minIdx = ALL_GRADES.indexOf(withActivity[0].grade)
		const maxIdx = ALL_GRADES.indexOf(withActivity[withActivity.length - 1].grade)
		return gradeDistribution.filter((g) => {
			const idx = ALL_GRADES.indexOf(g.grade)
			return idx >= Math.max(0, minIdx - 1) && idx <= Math.min(ALL_GRADES.length - 1, maxIdx + 1)
		})
	})

	// Tooltip state for heatmap
	let tooltip = $state<{ x: number; y: number; text: string } | null>(null)

	function showTooltip(e: MouseEvent, day: DayActivity) {
		if (!day.date) return
		const d = new Date(`${day.date}T00:00:00`)
		const label = d.toLocaleDateString('default', {
			weekday: 'short',
			month: 'short',
			day: 'numeric'
		})
		const text =
			day.climbCount === 0
				? `${label}: no activity`
				: `${label}: ${day.climbCount} climb${day.climbCount !== 1 ? 's' : ''}${day.tickCount > 0 ? `, ${day.tickCount} tick${day.tickCount !== 1 ? 's' : ''}` : ''}`
		tooltip = { x: e.offsetX, y: e.offsetY - 28, text }
	}
</script>

<svelte:head>
	<title>Training Stats — Kilterboard</title>
</svelte:head>

<div class="min-h-screen bg-bg text-text">
	<TopBar hideBoardControls />

	<main class="mx-auto max-w-4xl space-y-10 px-4 py-8">
		<!-- Page title + back -->
		<div class="flex items-center gap-4">
			<a
				href="/"
				class="flex size-9 items-center justify-center rounded-xl border border-border bg-surface-raised text-muted transition hover:text-text"
				aria-label="Back"
			>
				<svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M19 12H5M12 19l-7-7 7-7" stroke-linecap="round" stroke-linejoin="round" />
				</svg>
			</a>
			<div>
				<h1 class="text-xl font-bold text-text">Training Stats</h1>
				<p class="text-sm text-muted">Based on your local session log</p>
			</div>
		</div>

		<!-- Time range filter -->
		<div class="space-y-3">
			<div class="flex flex-wrap gap-2">
				{#each PRESETS as preset (preset.key)}
					<button
						class="rounded-xl border px-3 py-1.5 text-sm font-medium transition active:scale-95
							{rangePreset === preset.key
							? 'border-cyan-500 bg-cyan-500/10 text-cyan-400'
							: 'border-border bg-surface-raised text-muted hover:text-text'}"
						onclick={() => (rangePreset = preset.key)}
					>
						{preset.label}
					</button>
				{/each}
			</div>
			{#if rangePreset === 'custom'}
				<div class="flex flex-wrap items-center gap-3">
					<label class="flex items-center gap-2 text-sm text-muted">
						From
						<input
							type="date"
							bind:value={customFrom}
							class="rounded-lg border border-border bg-surface px-2 py-1 text-sm text-text focus:border-cyan-500 focus:outline-none"
						/>
					</label>
					<label class="flex items-center gap-2 text-sm text-muted">
						To
						<input
							type="date"
							bind:value={customTo}
							class="rounded-lg border border-border bg-surface px-2 py-1 text-sm text-text focus:border-cyan-500 focus:outline-none"
						/>
					</label>
				</div>
			{/if}
		</div>

		<!-- Summary cards -->
		<div class="grid grid-cols-2 gap-4 sm:grid-cols-3">
			<div class="rounded-2xl border border-border bg-surface p-5">
				<p class="text-xs font-medium uppercase tracking-widest text-muted">Climbs sent</p>
				<p class="mt-1 text-3xl font-bold text-cyan-400">{totalTicks}</p>
			</div>
			<div class="rounded-2xl border border-border bg-surface p-5">
				<p class="text-xs font-medium uppercase tracking-widest text-muted">Climbs lit up</p>
				<p class="mt-1 text-3xl font-bold text-cyan-400">{totalClimbsLit}</p>
			</div>
			<div class="rounded-2xl border border-border bg-surface p-5">
				<p class="text-xs font-medium uppercase tracking-widest text-muted">Total attempts</p>
				<p class="mt-1 text-3xl font-bold text-cyan-400">{totalAttempts}</p>
			</div>
		</div>

		<!-- Personal bests (#106) -->
		<section>
			<h2 class="mb-4 text-base font-semibold text-text">Personal bests</h2>
			<div class="grid grid-cols-3 gap-3">
				<div class="rounded-2xl border border-border bg-surface p-4 text-center">
					<p class="text-xs font-medium uppercase tracking-widest text-muted">Highest tick</p>
					<p class="mt-2 text-2xl font-bold text-cyan-400">{personalBests.highestTick != null ? formatGrade(personalBests.highestTick, settings.gradingSystem) : '—'}</p>
				</div>
				<div class="rounded-2xl border border-border bg-surface p-4 text-center">
					<p class="text-xs font-medium uppercase tracking-widest text-muted">Highest flash</p>
					<p class="mt-2 text-2xl font-bold text-cyan-400">{personalBests.highestFlash != null ? formatGrade(personalBests.highestFlash, settings.gradingSystem) : '—'}</p>
				</div>
				<div class="rounded-2xl border border-border bg-surface p-4 text-center">
					<p class="text-xs font-medium uppercase tracking-widest text-muted">Avg attempts/day</p>
					<p class="mt-2 text-2xl font-bold tabular-nums text-cyan-400">
						{personalBests.avgAttemptsPerDay ?? '—'}
					</p>
				</div>
			</div>
			<p class="mt-2 text-xs text-muted">
				Flash = ticked on first attempt · Requires ticking from the climb detail page
			</p>
		</section>

		<!-- Session heatmap -->
		<section>
			<h2 class="mb-4 text-base font-semibold text-text">Session activity</h2>
			{#if dailyActivity.every((d) => d.climbCount === 0)}
				<p class="text-sm text-muted">No activity recorded yet. Light up some climbs on the board!</p>
			{:else}
				<div class="overflow-x-auto">
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<svg
						width={heatmapWidth}
						height={heatmapHeight + 20}
						aria-label="Session activity heatmap"
						onmouseleave={() => (tooltip = null)}
					>
						<!-- Month labels -->
						{#each heatmapMonthLabels as { x, label } (x)}
							<text
								x={x}
								y={heatmapHeight + 16}
								fill="var(--color-muted)"
								font-size="9"
								font-family="inherit"
							>{label}</text>
						{/each}

						<!-- Day cells -->
						{#each heatmapWeeks as week, wi (wi)}
							{#each week as day, di (di)}
								<rect
									x={wi * CELL_STRIDE}
									y={di * CELL_STRIDE}
									width={CELL}
									height={CELL}
									rx="2"
									fill={day.date ? heatmapColor(day.climbCount) : 'transparent'}
									onmousemove={(e) => showTooltip(e, day)}
									style="cursor: {day.date && day.climbCount > 0 ? 'pointer' : 'default'}"
								/>
							{/each}
						{/each}
					</svg>
				</div>

				<!-- Tooltip -->
				{#if tooltip}
					<div
						class="pointer-events-none absolute z-50 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs text-text shadow-lg"
						style="left: {tooltip.x}px; top: {tooltip.y}px"
					>
						{tooltip.text}
					</div>
				{/if}

				<!-- Legend -->
				<div class="mt-2 flex items-center gap-2 text-xs text-muted">
					<span>Less</span>
					{#each [0, 0.25, 0.5, 0.75, 1] as ratio (ratio)}
						<div
							class="size-3 rounded-sm"
							style="background: {heatmapColor(Math.ceil(ratio * heatmapMax))}"
						></div>
					{/each}
					<span>More</span>
				</div>
			{/if}
		</section>

		<!-- Weekly intensity -->
		<section>
			<h2 class="mb-4 text-base font-semibold text-text">Weekly intensity</h2>
			{#if weeklyActivity.every((w) => w.climbCount === 0)}
				<p class="text-sm text-muted">No activity recorded yet.</p>
			{:else}
				<div class="overflow-x-auto">
					<svg
						width={barChartWidth}
						height={CHART_H + 20}
						aria-label="Weekly climb intensity bar chart"
					>
						{#each weeklyActivity as week, i (week.weekStart)}
							{@const barH = Math.max(2, Math.round((week.climbCount / weekMax) * CHART_H))}
							{@const x = i * (BAR_W + BAR_GAP)}
							<rect
								{x}
								y={CHART_H - barH}
								width={BAR_W}
								height={barH}
								rx="2"
								fill={week.climbCount > 0 ? 'rgb(6 182 212 / 0.7)' : 'var(--color-surface)'}
							/>
						{/each}
						<!-- Baseline -->
						<line x1="0" y1={CHART_H} x2={barChartWidth} y2={CHART_H} stroke="var(--color-border)" stroke-width="1" />
					</svg>
				</div>
				<p class="mt-1 text-xs text-muted">Each bar = one week · Height = climbs lit up</p>
			{/if}
		</section>

		<!-- Grade distribution (#107: two-tone bars) -->
		<section>
			<h2 class="mb-4 text-base font-semibold text-text">Grade distribution</h2>
			{#if gradeDistribution.every((g) => g.ticked + g.attemptedOnly === 0)}
				<p class="text-sm text-muted">
					No activity recorded yet. Send some climbs to see your grade pyramid!
				</p>
			{:else}
				<!-- Legend -->
				<div class="mb-3 flex items-center gap-4 text-xs text-muted">
					<span class="flex items-center gap-1.5">
						<span class="inline-block size-2.5 rounded-sm bg-cyan-500"></span>Ticked
					</span>
					<span class="flex items-center gap-1.5">
						<span class="inline-block size-2.5 rounded-sm bg-amber-400"></span>Attempted
					</span>
				</div>
				<div class="space-y-1.5">
					{#each gradesToShow as { grade, ticked, attemptedOnly } (grade)}
						{@const total = ticked + attemptedOnly}
						{@const tickedPct = total > 0 ? (ticked / total) * 100 : 0}
						{@const barPct = total === 0 ? 0 : Math.max(4, (total / gradeMax) * 100)}
						<div class="flex items-center gap-3">
							<span class="w-8 text-right text-xs font-semibold text-muted">{formatGrade(grade, settings.gradingSystem)}</span>
							<div class="flex-1 overflow-hidden rounded-full bg-surface">
								<div
									class="h-5 rounded-full transition-all duration-500"
									style="width: {barPct}%; background: linear-gradient(to right, rgb(6 182 212) {tickedPct}%, rgb(251 191 36) {tickedPct}%)"
								></div>
							</div>
							<span class="w-6 text-right text-xs text-muted">{total > 0 ? total : ''}</span>
						</div>
					{/each}
				</div>
				<p class="mt-3 text-xs text-muted">
					Only grades in active range shown · Requires ticking from the climb detail page
				</p>
			{/if}
		</section>
	</main>
</div>
