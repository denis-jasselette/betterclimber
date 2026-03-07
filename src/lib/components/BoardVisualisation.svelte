<script lang="ts">
	/**
	 * BoardVisualisation
	 *
	 * Renders the Kilter Board (16×12 Original Full Kit) with the real hold images as
	 * the background, then overlays coloured circles on the holds used by a climb.
	 *
	 * Image geometry:
	 *   Both board images (bolt-ons + screw-ons) are 1477×1200 landscape PNGs.
	 *   The images are displayed in their natural landscape orientation.
	 *     - Image X axis (left → right) = board Y axis (floor y=71 → ceiling y=1279)
	 *     - Image Y axis (top → bottom) = board X axis (left x=90 → right x=990)
	 *
	 * Coordinate mapping (hole {x,y} → SVG {cx,cy}):
	 *   imgX = IMG_PAD_X + (hole.y − 71) / 71  × IMG_STEP_X
	 *   imgY = IMG_PAD_Y + (hole.x − 90) / 90  × IMG_STEP_Y
	 *   Scale to SVG (display width = SVG_W, height = SVG_H = IMG_H × SVG_W/IMG_W):
	 *     svgX = imgX / IMG_W × SVG_W
	 *     svgY = imgY / IMG_H × SVG_H
	 */

	import { parseFrames } from '$lib/data/frames-parser';
	import { ROLE_COLORS } from '$lib/data/types';
	import type { RoleId } from '$lib/data/types';
	import holesJson from '$lib/data/mock/holes.json';
	import placementsJson from '$lib/data/mock/placements.json';

	interface Props {
		frames: string;
	}

	const { frames }: Props = $props();

	// ── Image constants ───────────────────────────────────────────────────────
	const IMG_W = 1477; // original image width  (landscape)
	const IMG_H = 1200; // original image height (landscape)

	// Grid spacing in original image pixels (derived from hole data)
	const IMG_PAD_X = 41.03;   // imgX of first column (hole.y = 71)
	const IMG_PAD_Y = 54.55;   // imgY of first row    (hole.x = 90)
	const IMG_STEP_X = 82.06;  // imgX step per hole.y increment of 71
	const IMG_STEP_Y = 109.09; // imgY step per hole.x increment of 90

	// ── SVG viewport ──────────────────────────────────────────────────────────
	// Display at full width SVG_W; height preserves the image aspect ratio.
	const SVG_W = 1477;
	const SVG_H = 1200;

	// ── Coordinate conversion ─────────────────────────────────────────────────
	function holeToSVG(hx: number, hy: number): { cx: number; cy: number } {
		const imgX = IMG_PAD_X + ((hy - 71) / 71) * IMG_STEP_X;
		const imgY = IMG_PAD_Y + ((hx - 90) / 90) * IMG_STEP_Y;
		return { cx: imgX, cy: imgY };
	}

	// ── Pre-build lookup: placementId → SVG coords ───────────────────────────
	interface HoleCoord { x: number; y: number }

	const holeById = new Map<number, HoleCoord>(holesJson.map((h) => [h.id, { x: h.x, y: h.y }]));

	const placementCoord = new Map<number, HoleCoord>();
	for (const p of placementsJson) {
		const hole = holeById.get(p.hole_id);
		if (hole) placementCoord.set(p.id, hole);
	}

	// ── Active holds (reactive on frames) ────────────────────────────────────
	interface ActiveHold {
		cx: number;
		cy: number;
		roleId: RoleId;
		color: string;
	}

	const activeHolds = $derived(
		parseFrames(frames).reduce<ActiveHold[]>((acc, t) => {
			const coord = placementCoord.get(t.placementId);
			if (coord) {
				const { cx, cy } = holeToSVG(coord.x, coord.y);
				acc.push({ cx, cy, roleId: t.roleId, color: ROLE_COLORS[t.roleId]?.hex ?? '#ffffff' });
			}
			return acc;
		}, [])
	);

	// Circle radii in SVG units (~82 px between hold columns in the image)
	const GLOW_R = 44;
	const HOLD_R = 32;
</script>

<div class="w-full" aria-label="Board visualisation">
	<svg
		viewBox="0 0 {SVG_W} {SVG_H}"
		xmlns="http://www.w3.org/2000/svg"
		class="w-full rounded-2xl border border-border bg-zinc-950"
		role="img"
		aria-label="Kilter Board hold map"
	>
		<!-- Board images: bolt-ons + screw-ons superimposed in native landscape orientation -->
		<image
			href="/board-bolt-ons.png"
			x="0" y="0"
			width={IMG_W} height={IMG_H}
			preserveAspectRatio="none"
		/>
		<image
			href="/board-screw-ons.png"
			x="0" y="0"
			width={IMG_W} height={IMG_H}
			preserveAspectRatio="none"
		/>

		<!-- Active holds: glow + filled circle in role colour -->
		{#each activeHolds as hold (hold.cx + '_' + hold.cy)}
			<!-- Outer glow -->
			<circle
				cx={hold.cx}
				cy={hold.cy}
				r={GLOW_R}
				fill={hold.color}
				opacity="0.25"
			/>
			<!-- Main circle -->
			<circle
				cx={hold.cx}
				cy={hold.cy}
				r={HOLD_R}
				fill={hold.color}
				opacity="0.88"
			/>
		{/each}
	</svg>
</div>
