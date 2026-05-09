<script lang="ts">
	import TopBar from '$lib/components/TopBar.svelte'
	import { ALL_GRADES, formatGrade } from '$lib/data/types'
	import { settings } from '$lib/settings-store.svelte'

	// ── Types ──────────────────────────────────────────────────────────────────

	interface HeatmapDay {
		date: string
		count: number
	}

	interface GradeBar {
		grade: string
		ticked: number
		attempted: number
	}

	interface PersonalBests {
		highestFlashed: string | null
		highestTicked: string | null
		avgAttemptsPerDay: number | null
	}

	type TimeRange = 'all' | '1y' | '3m' | '1m' | 'custom'

	// ── State ──────────────────────────────────────────────────────────────────

	let loading = $state(true)
	let heatmap = $state<HeatmapDay[]>([])
	let gradeDistribution = $state<GradeBar[]>([])
	let totalAttempts = $state(0)
	let personalBests = $state<PersonalBests>({
		highestFlashed: null,
		highestTicked: null,
		avgAttemptsPerDay: null
	})

	let timeRange = $state<TimeRange>('all')
	let customFrom = $state('')
	let customTo = $state('')

	// ── Time range presets ─────────────────────────────────────────────────────

	const PRESETS: { label: string; value: TimeRange }[] = [
		{ label: 'All time', value: 'all' },
		{ label: '1 Year', value: '1y' },
		{ label: '3 Months', value: '3m' },
		{ label: '1 Month', value: '1m' },
		{ label: 'Custom', value: 'custom' }
	]

	function getDateParams(range: TimeRange, from: string, to: string): string {
		const today = new Date()
		const fmt = (d: Date) => d.toISOString().slice(0, 10)

		if (range === 'all') return ''
		if (range === 'custom') {
			const parts: string[] = []
			if (from) parts.push(`from=${from}`)
			if (to) parts.push(`to=${to}`)
			return parts.length ? `?${parts.join('&')}` : ''
		}

		const from2 = new Date(today)
		if (range === '1y') from2.setFullYear(from2.getFullYear() - 1)
		else if (range === '3m') from2.setMonth(from2.getMonth() - 3)
		else if (range === '1m') from2.setMonth(from2.getMonth() - 1)

		return `?from=${fmt(from2)}&to=${fmt(today)}`
	}

	async function fetchStats() {
		loading = true
		try {
			const qs = getDateParams(timeRange, customFrom, customTo)
			const res = await fetch(`/api/stats${qs}`)
			if (res.ok) {
				const data = await res.json()
				heatmap = data.heatmap
				gradeDistribution = data.gradeDistribution
				totalAttempts = data.totalAttempts ?? 0
				personalBests = data.personalBests ?? {
					highestFlashed: null,
					highestTicked: null,
					avgAttemptsPerDay: null
				}
			}
		} finally {
			loading = false
		}
	}

	$effect(() => {
		// Runs on mount and whenever time range / custom dates change
		timeRange
		customFrom
		customTo
		fetchStats()
	})

	// ── Heatmap helpers ────────────────────────────────────────────────────────

	/** Build a 52-week × 7-day grid of ISO date strings. */
	const grid = $derived(
		(() => {
			const today = new Date()
			const start = new Date(today)
			start.setDate(start.getDate() - 7 * 52)
			start.setDate(start.getDate() - start.getDay())

			const cells: string[] = []
			const d = new Date(start)
			while (d <= today) {
				cells.push(d.toISOString().slice(0, 10))
				d.setDate(d.getDate() + 1)
			}
			return cells
		})()
	)

	const heatmapMap = $derived(new Map(heatmap.map((h) => [h.date, h.count])))
	const maxCount = $derived(Math.max(1, ...heatmap.map((h) => h.count)))

	function intensityClass(count: number): string {
		if (count === 0) return 'fill-surface-raised'
		const ratio = count / maxCount
		if (ratio < 0.25) return 'fill-green-900'
		if (ratio < 0.5) return 'fill-green-700'
		if (ratio < 0.75) return 'fill-green-500'
		return 'fill-green-400'
	}

	const weeks = $derived(
		(() => {
			const cols: string[][] = []
			for (let i = 0; i < grid.length; i += 7) {
				cols.push(grid.slice(i, i + 7))
			}
			return cols
		})()
	)

	// ── Grade distribution helpers ─────────────────────────────────────────────

	const allGrades = $derived(
		ALL_GRADES.map((g) => {
			const bar = gradeDistribution.find((gd) => gd.grade === g)
			return {
				label: formatGrade(g, settings.gradingSystem),
				vGrade: g,
				ticked: bar?.ticked ?? 0,
				attempted: bar?.attempted ?? 0,
				total: (bar?.ticked ?? 0) + (bar?.attempted ?? 0)
			}
		}).filter((g) => g.total > 0)
	)

	const maxGradeCount = $derived(Math.max(1, ...allGrades.map((g) => g.total)))

	// Summary totals
	const totalTicks = $derived(gradeDistribution.reduce((sum, g) => sum + g.ticked, 0))

	const last30Days = $derived(
		(() => {
			const cutoff = new Date()
			cutoff.setDate(cutoff.getDate() - 30)
			const cutoffStr = cutoff.toISOString().slice(0, 10)
			return heatmap.filter((h) => h.date >= cutoffStr).reduce((sum, h) => sum + h.count, 0)
		})()
	)

	// Whether the summary/personal bests are all-time (no range filter active)
	const isAllTime = $derived(
		timeRange === 'all' || (timeRange === 'custom' && !customFrom && !customTo)
	)
</script>

<svelte:head>
	<title>Training Stats — Kilterboard</title>
</svelte:head>

<div class="min-h-screen bg-bg text-text">
	<TopBar angle={null} />

	<div class="mx-auto max-w-2xl px-4 py-6">
		<!-- Header -->
		<div class="mb-6">
			<a href="/" class="text-sm text-muted transition hover:text-text">← Home</a>
			<h1 class="mt-2 text-2xl font-bold text-text">Training Stats</h1>
		</div>

		<!-- Time range selector -->
		<div class="mb-6">
			<div class="flex flex-wrap gap-1.5">
				{#each PRESETS as preset (preset.value)}
					<button
						class="rounded-full border px-3 py-1 text-xs font-medium transition
							{timeRange === preset.value
							? 'border-accent bg-accent/10 text-accent'
							: 'border-border bg-surface text-muted hover:text-text'}"
						onclick={() => { timeRange = preset.value }}
					>
						{preset.label}
					</button>
				{/each}
			</div>
			{#if timeRange === 'custom'}
				<div class="mt-3 flex flex-wrap gap-3">
					<label class="flex items-center gap-2 text-xs text-muted">
						From
						<input
							type="date"
							class="rounded-lg border border-border bg-surface px-2 py-1 text-sm text-text focus:border-accent focus:outline-none"
							bind:value={customFrom}
						/>
					</label>
					<label class="flex items-center gap-2 text-xs text-muted">
						To
						<input
							type="date"
							class="rounded-lg border border-border bg-surface px-2 py-1 text-sm text-text focus:border-accent focus:outline-none"
							bind:value={customTo}
						/>
					</label>
				</div>
			{/if}
		</div>

		{#if loading}
			<!-- Loading skeletons -->
			<div class="space-y-6">
				<div class="h-24 animate-pulse rounded-2xl bg-surface"></div>
				<div class="h-24 animate-pulse rounded-2xl bg-surface"></div>
				<div class="h-48 animate-pulse rounded-2xl bg-surface"></div>
				<div class="h-48 animate-pulse rounded-2xl bg-surface"></div>
			</div>
		{:else}
			<!-- Summary cards -->
			<div class="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
				<div class="rounded-2xl border border-border bg-surface p-4 text-center">
					<div class="text-2xl font-bold text-text tabular-nums">{totalTicks}</div>
					<div class="mt-0.5 text-xs text-muted">Problems ticked</div>
				</div>
				<div class="rounded-2xl border border-border bg-surface p-4 text-center">
					<div class="text-2xl font-bold text-text tabular-nums">{totalAttempts}</div>
					<div class="mt-0.5 text-xs text-muted">Total attempts</div>
				</div>
				<div class="rounded-2xl border border-border bg-surface p-4 text-center">
					<div class="text-2xl font-bold text-text tabular-nums">{last30Days}</div>
					<div class="mt-0.5 text-xs text-muted">Activity this month</div>
				</div>
				<div class="rounded-2xl border border-border bg-surface p-4 text-center">
					<div class="text-2xl font-bold text-text tabular-nums">
						{gradeDistribution.reduce((s, g) => s + g.attempted, 0)}
					</div>
					<div class="mt-0.5 text-xs text-muted">Projects in progress</div>
				</div>
			</div>

			<!-- Personal bests -->
			<div class="mb-6 rounded-2xl border border-border bg-surface p-4">
				<h2 class="mb-3 text-xs font-semibold tracking-wider text-muted uppercase">
					Personal bests{isAllTime ? '' : ' (selected period)'}
				</h2>
				<div class="grid grid-cols-3 gap-4 text-center">
					<div>
						<div class="text-xl font-bold text-text">
							{personalBests.highestTicked ?? '—'}
						</div>
						<div class="mt-0.5 text-xs text-muted">Highest ticked</div>
					</div>
					<div>
						<div class="text-xl font-bold text-text">
							{personalBests.highestFlashed ?? '—'}
						</div>
						<div class="mt-0.5 text-xs text-muted">Highest flashed</div>
					</div>
					<div>
						<div class="text-xl font-bold text-text tabular-nums">
							{personalBests.avgAttemptsPerDay !== null ? personalBests.avgAttemptsPerDay : '—'}
						</div>
						<div class="mt-0.5 text-xs text-muted">Avg attempts / day</div>
					</div>
				</div>
			</div>

			<!-- Activity heatmap -->
			<div class="mb-6 rounded-2xl border border-border bg-surface p-4">
				<h2 class="mb-3 text-xs font-semibold tracking-wider text-muted uppercase">
					Activity heatmap (52 weeks)
				</h2>
				{#if heatmap.length === 0}
					<p class="py-4 text-center text-sm text-muted">No activity recorded yet.</p>
				{:else}
					<div class="overflow-x-auto">
						<svg
							width={weeks.length * 12 + 4}
							height={7 * 12 + 4}
							class="block"
							aria-label="Activity heatmap"
						>
							{#each weeks as week, wi (wi)}
								{#each week as day, di (day)}
									{@const count = heatmapMap.get(day) ?? 0}
									<rect
										x={wi * 12 + 2}
										y={di * 12 + 2}
										width={10}
										height={10}
										rx={2}
										class="{intensityClass(count)} transition-colors"
									>
										<title>{day}: {count} {count === 1 ? 'entry' : 'entries'}</title>
									</rect>
								{/each}
							{/each}
						</svg>
					</div>
					<div class="mt-2 flex items-center gap-1.5 text-xs text-muted">
						<span>Less</span>
						<svg width="68" height="10">
							{#each ['fill-surface-raised', 'fill-green-900', 'fill-green-700', 'fill-green-500', 'fill-green-400'] as cls, i (i)}
								<rect x={i * 14} y={0} width={10} height={10} rx={2} class={cls} />
							{/each}
						</svg>
						<span>More</span>
					</div>
				{/if}
			</div>

			<!-- Grade pyramid (two-tone) -->
			<div class="rounded-2xl border border-border bg-surface p-4">
				<div class="mb-3 flex items-center justify-between">
					<h2 class="text-xs font-semibold tracking-wider text-muted uppercase">
						Grade distribution
					</h2>
					<!-- Legend -->
					<div class="flex items-center gap-3 text-xs text-muted">
						<span class="flex items-center gap-1">
							<span class="inline-block h-2.5 w-2.5 rounded-sm bg-green-500"></span>
							Ticked
						</span>
						<span class="flex items-center gap-1">
							<span class="inline-block h-2.5 w-2.5 rounded-sm bg-yellow-500"></span>
							Attempted
						</span>
					</div>
				</div>
				{#if allGrades.length === 0}
					<p class="py-4 text-center text-sm text-muted">No activity recorded yet.</p>
				{:else}
					<div class="space-y-1.5">
						{#each [...allGrades].reverse() as g (g.vGrade)}
							{@const barWidth = (g.total / maxGradeCount) * 100}
							{@const tickedPct = g.total > 0 ? (g.ticked / g.total) * 100 : 0}
							{@const attemptedPct = g.total > 0 ? (g.attempted / g.total) * 100 : 0}
							<div class="flex items-center gap-2">
								<span class="w-8 shrink-0 text-right text-xs font-semibold text-muted">
									{g.label}
								</span>
								<div class="flex-1">
									<div
										class="flex h-5 overflow-hidden rounded transition-all"
										style="width: {barWidth}%"
									>
										{#if g.ticked > 0}
											<div
												class="h-full bg-green-500 transition-all"
												style="width: {tickedPct}%"
												title="{g.ticked} ticked"
											></div>
										{/if}
										{#if g.attempted > 0}
											<div
												class="h-full bg-yellow-500 transition-all"
												style="width: {attemptedPct}%"
												title="{g.attempted} attempted"
											></div>
										{/if}
									</div>
								</div>
								<span class="w-6 shrink-0 text-right text-xs text-muted tabular-nums">
									{g.total}
								</span>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		{/if}
	</div>
</div>
