<script lang="ts">
	import { onMount } from 'svelte'
	import TopBar from '$lib/components/TopBar.svelte'
	import { ALL_GRADES, formatGrade } from '$lib/data/types'
	import { settings } from '$lib/settings-store.svelte'

	interface HeatmapDay {
		date: string
		count: number
	}

	interface GradeBar {
		grade: string
		count: number
	}

	let loading = $state(true)
	let heatmap = $state<HeatmapDay[]>([])
	let gradeDistribution = $state<GradeBar[]>([])

	onMount(async () => {
		try {
			const res = await fetch('/api/stats')
			if (res.ok) {
				const data = await res.json()
				heatmap = data.heatmap
				gradeDistribution = data.gradeDistribution
			}
		} finally {
			loading = false
		}
	})

	// ── Heatmap helpers ────────────────────────────────────────────────────────

	/** Build a 52-week × 7-day grid of ISO date strings. */
	const grid = $derived(
		(() => {
			const today = new Date()
			// Start from the Sunday 52 weeks ago
			const start = new Date(today)
			start.setDate(start.getDate() - 7 * 52)
			// Adjust to the nearest preceding Sunday
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

	// Group grid cells into columns (weeks)
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

	const maxGradeCount = $derived(Math.max(1, ...gradeDistribution.map((g) => g.count)))

	const allGrades = $derived(
		ALL_GRADES.map((g) => ({
			label: formatGrade(g, settings.gradingSystem),
			vGrade: g,
			count: gradeDistribution.find((gd) => gd.grade === g)?.count ?? 0
		})).filter((g) => g.count > 0)
	)

	// Total ticked count
	const totalTicks = $derived(gradeDistribution.reduce((sum, g) => sum + g.count, 0))

	// Activity in the last 30 days
	const last30Days = $derived(
		(() => {
			const cutoff = new Date()
			cutoff.setDate(cutoff.getDate() - 30)
			const cutoffStr = cutoff.toISOString().slice(0, 10)
			return heatmap.filter((h) => h.date >= cutoffStr).reduce((sum, h) => sum + h.count, 0)
		})()
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

		{#if loading}
			<!-- Loading skeletons -->
			<div class="space-y-6">
				<div class="h-32 animate-pulse rounded-2xl bg-surface"></div>
				<div class="h-48 animate-pulse rounded-2xl bg-surface"></div>
			</div>
		{:else}
			<!-- Summary row -->
			<div class="mb-6 grid grid-cols-2 gap-3">
				<div class="rounded-2xl border border-border bg-surface p-4 text-center">
					<div class="text-2xl font-bold text-text tabular-nums">{totalTicks}</div>
					<div class="mt-0.5 text-xs text-muted">Problems ticked</div>
				</div>
				<div class="rounded-2xl border border-border bg-surface p-4 text-center">
					<div class="text-2xl font-bold text-text tabular-nums">{last30Days}</div>
					<div class="mt-0.5 text-xs text-muted">Activity this month</div>
				</div>
			</div>

			<!-- Activity heatmap -->
			<div class="mb-6 rounded-2xl border border-border bg-surface p-4">
				<h2 class="mb-3 text-xs font-semibold tracking-wider text-muted uppercase">
					Activity heatmap
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

			<!-- Grade pyramid -->
			<div class="rounded-2xl border border-border bg-surface p-4">
				<h2 class="mb-3 text-xs font-semibold tracking-wider text-muted uppercase">
					Ticked grade pyramid
				</h2>
				{#if allGrades.length === 0}
					<p class="py-4 text-center text-sm text-muted">No ticked climbs yet.</p>
				{:else}
					<div class="space-y-1.5">
						{#each [...allGrades].reverse() as g (g.vGrade)}
							<div class="flex items-center gap-2">
								<span class="w-8 shrink-0 text-right text-xs font-semibold text-muted"
									>{g.label}</span
								>
								<div class="flex-1">
									<div
										class="h-5 rounded bg-green-600/30 transition-all"
										style="width: {(g.count / maxGradeCount) * 100}%"
									>
										<div
											class="h-full rounded bg-green-500 transition-all"
											style="width: 100%"
										></div>
									</div>
								</div>
								<span class="w-6 shrink-0 text-right text-xs text-muted tabular-nums"
									>{g.count}</span
								>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		{/if}
	</div>
</div>
