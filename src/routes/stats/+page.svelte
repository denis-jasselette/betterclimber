<script lang="ts">
	import { onMount } from 'svelte'
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
	import { ALL_GRADES } from '$lib/data/types'

	type TimeRange = 'all' | '1y' | '3m' | '1m' | 'custom'

	// ── Time range ────────────────────────────────────────────────────────────
	let selectedRange = $state<TimeRange>('all')
	let customFrom = $state('')
	let customTo = $state('')

	const dateRange = $derived.by((): DateRange => {
		if (selectedRange === 'all') return { from: null, to: null }
		if (selectedRange === 'custom') {
			return {
				from: customFrom ? new Date(customFrom) : null,
				to: customTo ? new Date(`${customTo}T23:59:59`) : null
			}
		}
		const days = selectedRange === '1y' ? 365 : selectedRange === '3m' ? 90 : 30
		const from = new Date()
		from.setDate(from.getDate() - days)
		return { from, to: null }
	})

	// ── Data ──────────────────────────────────────────────────────────────────
	let mounted = $state(false)
	let dailyActivity = $state<DayActivity[]>([])
	let weeklyActivity = $state<WeekActivity[]>([])
	let gradeDistribution = $state<GradeCount[]>([])
	let totalTicks = $state(0)
	let totalClimbsLit = $state(0)
	let totalAttempts = $state(0)
	let personalBests = $state<PersonalBests>({
		highestFlash: null,
		highestTick: null,
		avgAttemptsPerDay: null
	})

	function refreshStats() {
		const range = dateRange
		const windowRange = selectedRange === 'all' ? 182 : range
		dailyActivity = getActivityByDay(windowRange)
		weeklyActivity = getActivityByWeek(windowRange)
		gradeDistribution = getGradeDistribution(range.from || range.to ? range : undefined)
		totalTicks = getTotalTicks(range.from || range.to ? range : undefined)
		totalClimbsLit = getTotalClimbsLit(range.from || range.to ? range : undefined)
		totalAttempts = getTotalAttempts(range.from || range.to ? range : undefined)
		personalBests = getPersonalBests(range.from || range.to ? range : undefined)
	}

	onMount(() => {
		mounted = true
		refreshStats()
	})

	$effect(() => {
		if (!mounted) return
		// Re-run whenever range inputs change
		selectedRange
		customFrom
		customTo
		refreshStats()
	})

	// ── Heatmap (GitHub-style calendar) ───────────────────────────────────────
	const CELL = 12
	const GAP = 2
	const CELL_STRIDE = CELL + GAP

	const heatmapWeeks = $derived.by(() => {
		if (dailyActivity.length === 0) return []
		const weeks: DayActivity[][] = []
		let week: DayActivity[] = []
		for (const day of dailyActivity) {
			const dow = new Date(`${day.date}T00:00:00`).getDay()
			const col = dow === 0 ? 6 : dow - 1
			if (week.length === 0 && col !== 0) {
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
		if (ratio < 0.25) return 'rgb(8 145 178 / 0.3)'
		if (ratio < 0.5) return 'rgb(8 145 178 / 0.55)'
		if (ratio < 0.75) return 'rgb(6 182 212 / 0.75)'
		return 'rgb(6 182 212)'
	}

	const heatmapWidth = $derived(heatmapWeeks.length * CELL_STRIDE)
	const heatmapHeight = 7 * CELL_STRIDE

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

	<main class="mx-auto max-w-4xl space-y-8 px-4 py-8">
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

		<!-- Time range selector (#104) -->
		<div>
			<div class="flex flex-wrap gap-2">
				{#each ([['all', 'All time'], ['1y', '1Y'], ['3m', '3M'], ['1m', '1M'], ['custom', 'Custom']] as const) as [val, label] (val)}
					<button
						class="rounded-lg border px-3 py-1.5 text-sm font-medium transition {selectedRange === val
							? 'border-cyan-500 bg-cyan-500/10 text-cyan-400'
							: 'border-border bg-surface text-muted hover:text-text'}"
						onclick={() => (selectedRange = val)}
					>
						{label}
					</button>
				{/each}
			</div>
			{#if selectedRange === 'custom'}
				<div class="mt-3 flex flex-wrap items-center gap-3">
					<label class="flex items-center gap-2 text-sm text-muted">
						From
						<input
							type="date"
							bind:value={customFrom}
							class="rounded-lg border border-border bg-surface px-2 py-1 text-sm text-text"
						/>
					</label>
					<label class="flex items-center gap-2 text-sm text-muted">
						To
						<input
							type="date"
							bind:value={customTo}
							class="rounded-lg border border-border bg-surface px-2 py-1 text-sm text-text"
						/>
					</label>
				</div>
			{/if}
		</div>

		<!-- Summary cards (#105: total attempts) -->
		<div class="grid grid-cols-3 gap-4">
			<div class="rounded-2xl border border-border bg-surface p-5">
				<p class="text-xs font-medium uppercase tracking-widest text-muted">Climbs sent</p>
				<p class="mt-1 text-3xl font-bold text-cyan-400">{totalTicks}</p>
			</div>
			<div class="rounded-2xl border border-border bg-surface p-5">
				<p class="text-xs font-medium uppercase tracking-widest text-muted">Total attempts</p>
				<p class="mt-1 text-3xl font-bold text-cyan-400">{totalAttempts}</p>
			</div>
			<div class="rounded-2xl border border-border bg-surface p-5">
				<p class="text-xs font-medium uppercase tracking-widest text-muted">Climbs lit up</p>
				<p class="mt-1 text-3xl font-bold text-cyan-400">{totalClimbsLit}</p>
			</div>
		</div>

		<!-- Personal bests (#106) -->
		<section>
			<h2 class="mb-4 text-base font-semibold text-text">Personal bests</h2>
			<div class="grid grid-cols-3 gap-4">
				<div class="rounded-2xl border border-border bg-surface p-5 text-center">
					<p class="text-xs font-medium uppercase tracking-widest text-muted">Highest tick</p>
					<p class="mt-1 text-2xl font-bold text-text">{personalBests.highestTick ?? '—'}</p>
				</div>
				<div class="rounded-2xl border border-border bg-surface p-5 text-center">
					<p class="text-xs font-medium uppercase tracking-widest text-muted">Highest flash</p>
					<p class="mt-1 text-2xl font-bold text-text">{personalBests.highestFlash ?? '—'}</p>
				</div>
				<div class="rounded-2xl border border-border bg-surface p-5 text-center">
					<p class="text-xs font-medium uppercase tracking-widest text-muted">Avg attempts/day</p>
					<p class="mt-1 text-2xl font-bold text-text tabular-nums">
						{personalBests.avgAttemptsPerDay ?? '—'}
					</p>
				</div>
			</div>
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
						{#each heatmapMonthLabels as { x, label }}
							<text
								x={x}
								y={heatmapHeight + 16}
								fill="var(--color-muted)"
								font-size="9"
								font-family="inherit">{label}</text
							>
						{/each}

						{#each heatmapWeeks as week, wi}
							{#each week as day, di}
								<!-- svelte-ignore a11y_mouse_events_have_key_events -->
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

				{#if tooltip}
					<div
						class="pointer-events-none absolute z-50 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs text-text shadow-lg"
						style="left: {tooltip.x}px; top: {tooltip.y}px"
					>
						{tooltip.text}
					</div>
				{/if}

				<div class="mt-2 flex items-center gap-2 text-xs text-muted">
					<span>Less</span>
					{#each [0, 0.25, 0.5, 0.75, 1] as ratio}
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
						{#each weeklyActivity as week, i}
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
						<line
							x1="0"
							y1={CHART_H}
							x2={barChartWidth}
							y2={CHART_H}
							stroke="var(--color-border)"
							stroke-width="1"
						/>
					</svg>
				</div>
				<p class="mt-1 text-xs text-muted">Each bar = one week · Height = climbs lit up</p>
			{/if}
		</section>

		<!-- Grade distribution (#107: two-tone bars) -->
		<section>
			<h2 class="mb-4 text-base font-semibold text-text">Grade distribution</h2>
			{#if gradesToShow.length === 0}
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
						<span class="inline-block size-2.5 rounded-sm bg-amber-500"></span>Attempted
					</span>
				</div>
				<div class="space-y-1.5">
					{#each gradesToShow as { grade, ticked, attemptedOnly }}
						{@const total = ticked + attemptedOnly}
						{@const tickedPct = total > 0 ? (ticked / total) * 100 : 0}
						{@const attemptPct = total > 0 ? (attemptedOnly / total) * 100 : 0}
						{@const barWidth = total === 0 ? 0 : Math.max(4, (total / gradeMax) * 100)}
						<div class="flex items-center gap-3">
							<span class="w-8 text-right text-xs font-semibold text-muted">{grade}</span>
							<div class="flex-1 overflow-hidden rounded-full bg-surface">
								<div
									class="flex h-5 overflow-hidden rounded-full transition-all duration-500"
									style="width: {barWidth}%"
								>
									{#if ticked > 0}
										<div
											class="h-full shrink-0 bg-cyan-500"
											style="width: {tickedPct}%"
										></div>
									{/if}
									{#if attemptedOnly > 0}
										<div
											class="h-full shrink-0 bg-amber-500"
											style="width: {attemptPct}%"
										></div>
									{/if}
								</div>
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
