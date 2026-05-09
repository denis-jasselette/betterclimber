<script lang="ts">
	/**
	 * BoardEditor
	 *
	 * Interactive Kilter Board hold picker. Shows all placements as invisible tap
	 * targets; clicking cycles the hold through:
	 *   off → HAND → FOOT → START → FINISH → off
	 * The `frames` prop is kept in sync via $bindable so the parent always has the
	 * current frames string. Pass an existing frames string to pre-populate the editor
	 * (for editing an existing climb).
	 */

	import { SvelteMap } from 'svelte/reactivity'
	import BoardBoltOns from '$lib/assets/board-bolt-ons.png'
	import BoardScrewOns from '$lib/assets/board-screw-ons.png'
	import holesJson from '$lib/data/mock/holes.json'
	import placementsJson from '$lib/data/mock/placements.json'
	import type { Placement, RoleId } from '$lib/data/types'
	import { isSetId, ROLE_COLORS, ROLE_LABELS, SET_RADII } from '$lib/data/types'

	let { frames = $bindable('') }: { frames?: string } = $props()

	const IMG_W = 1477
	const IMG_H = 1200

	function transformX(x: number) {
		return x * 7.6 + 190.4
	}

	function transformY(y: number) {
		return y * -7.7 + 1198.5
	}

	// ── Build lookup maps from JSON ───────────────────────────────────────────

	// layout_id 1 = Kilter Board Original Full Kit (the only board we support).
	// placements.json contains 3773 entries across 8 layouts; the other 7 layouts
	// have different board geometries and must not be shown on this board image.
	const LAYOUT_ID = 1
	const boardPlacements = (placementsJson as Placement[]).filter((p) => p.layout_id === LAYOUT_ID)

	interface HoleXY {
		x: number
		y: number
	}
	const holeMap = new Map<number, HoleXY>(
		(holesJson as Array<{ id: number; x: number; y: number }>).map((h) => [h.id, h])
	)

	// Precompute visual coords for every placement in this layout
	const placementVisuals = boardPlacements.map((p) => {
		const hole = holeMap.get(p.hole_id)
		return {
			id: p.id,
			set_id: p.set_id,
			cx: hole ? transformX(hole.x) : -9999,
			cy: hole ? transformY(hole.y) : -9999,
			radius: isSetId(p.set_id) ? SET_RADII[p.set_id] : 32
		}
	})

	// ── Role cycling ──────────────────────────────────────────────────────────
	// Order: HAND (middle) → FOOT (foot-only) → START → FINISH
	// Most common types first so the user reaches them with fewer taps.
	const ROLE_CYCLE: (RoleId | null)[] = [null, 13, 15, 12, 14]

	// Parse an existing frames string into placement→role entries
	function parseInitialFrames(s: string): Array<[number, RoleId]> {
		const entries: Array<[number, RoleId]> = []
		for (const m of s.matchAll(/p(\d+)r(\d+)/g)) {
			const pid = Number(m[1])
			const rid = Number(m[2]) as RoleId
			if (ROLE_CYCLE.includes(rid)) entries.push([pid, rid])
		}
		return entries
	}

	// placementId → RoleId (only active holds); pre-populated from the initial frames
	const activeHolds = new SvelteMap<number, RoleId>(parseInitialFrames(frames))

	function cycleHold(placementId: number) {
		const current = activeHolds.get(placementId) ?? null
		const idx = ROLE_CYCLE.indexOf(current)
		const next = ROLE_CYCLE[(idx + 1) % ROLE_CYCLE.length]
		if (next === null) {
			activeHolds.delete(placementId)
		} else {
			activeHolds.set(placementId, next)
		}
	}

	function clearAll() {
		activeHolds.clear()
	}

	// ── Sync frames ↔ activeHolds ─────────────────────────────────────────────

	// When activeHolds changes, recompute the frames string
	$effect(() => {
		const parts: string[] = []
		for (const [id, roleId] of activeHolds) {
			parts.push(`p${id}r${roleId}`)
		}
		frames = parts.join('')
	})

	// ── Legend data ───────────────────────────────────────────────────────────

	const LEGEND: { roleId: RoleId; label: string; color: string }[] = [
		{ roleId: 13, label: ROLE_LABELS[13], color: ROLE_COLORS[13].hex },
		{ roleId: 15, label: ROLE_LABELS[15], color: ROLE_COLORS[15].hex },
		{ roleId: 12, label: ROLE_LABELS[12], color: ROLE_COLORS[12].hex },
		{ roleId: 14, label: ROLE_LABELS[14], color: ROLE_COLORS[14].hex }
	]

	const holdCount = $derived(activeHolds.size)
</script>

<div class="space-y-3">
	<!-- Board -->
	<div class="w-full rounded-2xl border border-border bg-zinc-950" aria-label="Board editor">
		<svg
			viewBox="0 0 {IMG_W} {IMG_H}"
			xmlns="http://www.w3.org/2000/svg"
			class="w-full cursor-crosshair touch-none"
			role="img"
			aria-label="Kilter Board hold picker — tap a hold to set its role"
		>
			<image href={BoardBoltOns} width={IMG_W} height={IMG_H} />
			<image href={BoardScrewOns} width={IMG_W} height={IMG_H} />

			<!-- Tap targets (always invisible) + active hold rings -->
			{#each placementVisuals as p (p.id)}
				{@const roleId = activeHolds.get(p.id)}
				<!-- Invisible tap target -->
				<circle
					cx={p.cx}
					cy={p.cy}
					r={p.radius}
					fill="transparent"
					stroke="none"
					onclick={() => cycleHold(p.id)}
					role="button"
					aria-label="Hold {p.id}"
					tabindex="0"
					onkeydown={(e) => e.key === 'Enter' && cycleHold(p.id)}
					style="cursor: pointer"
				/>
				<!-- Visible ring — only rendered when active -->
				{#if roleId !== undefined}
					<circle
						cx={p.cx}
						cy={p.cy}
						r={p.radius}
						stroke={ROLE_COLORS[roleId].hex}
						stroke-width={8}
						fill="transparent"
						opacity={0.85}
						pointer-events="none"
					/>
				{/if}
			{/each}
		</svg>
	</div>

	<!-- Controls row -->
	<div class="flex items-center justify-between gap-3">
		<!-- Legend -->
		<div class="flex flex-wrap gap-x-4 gap-y-1">
			{#each LEGEND as { color, label } (label)}
				<div class="flex items-center gap-1.5 text-xs text-muted">
					<span class="size-2.5 rounded-full" style="background:{color}"></span>
					{label}
				</div>
			{/each}
		</div>

		<!-- Hold count + clear -->
		<div class="flex items-center gap-2">
			<span class="text-xs text-muted">{holdCount} hold{holdCount === 1 ? '' : 's'}</span>
			{#if holdCount > 0}
				<button
					onclick={clearAll}
					class="rounded-lg border border-border px-2.5 py-1 text-xs text-muted transition hover:border-red-500/50 hover:text-red-400 active:scale-95"
				>
					Clear
				</button>
			{/if}
		</div>
	</div>
</div>
