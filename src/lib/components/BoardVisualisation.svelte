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
	 *
	 * Hole coordinates:
	 *   holes.json stores raw DB integer coordinates (x, y).
	 *   transformPosition() converts them to pixel positions in the 1477×1200 image
	 *   space at runtime using a linear mapping:
	 *     DB(-16, 176) → pixel (60,   33)
	 *     DB(160,   8) → pixel (1423, 1130)
	 *
	 * Placement lookup:
	 *   The frames string contains placement IDs. placements.json maps each
	 *   placement_id → hole_id, which is then used to look up coordinates in holesMap.
	 */

	import { parseFrames } from '$lib/data/frames-parser';
	import holesJson from '$lib/data/mock/holes.json';
	import placementsJson from '$lib/data/mock/placements.json';
	import type { RoleId } from '$lib/data/types';
	import { ROLE_COLORS } from '$lib/data/types';
	import { SvelteMap } from 'svelte/reactivity';

	interface Props {
		frames: string;
	}

	const { frames }: Props = $props();

	// ── Image constants ───────────────────────────────────────────────────────
	const IMG_W = 1477; // original image width  (landscape)
	const IMG_H = 1200; // original image height (landscape)

	// ── SVG viewport ──────────────────────────────────────────────────────────
	// Display at full width SVG_W; height preserves the image aspect ratio.
	const SVG_W = 1477;
	const SVG_H = 1200;

	// ── Active holds (reactive on frames) ────────────────────────────────────
	interface ActiveHold {
		cx: number;
		cy: number;
		roleId: RoleId;
		color: string;
	}

	function transformPosition({ x, y }: { x: number; y: number }) {
		const xScale = 7.6;
		const xOffset = 190.4;

		const yScale = -7.7;
		const yOffset = 1198.5;

		return {
			x: x * xScale + xOffset,
			y: y * yScale + yOffset
		};
	}

	const holesMap = new SvelteMap<number, { x: number; y: number }>();
	for (const hole of holesJson) {
		holesMap.set(hole.id, transformPosition(hole));
	}

	// placementId → hole_id (frames strings carry placement IDs, not hole IDs)
	const placementsMap = new SvelteMap<number, number>();
	for (const placement of placementsJson) {
		placementsMap.set(placement.id, placement.hole_id);
	}

	const activeHolds = $derived(
		parseFrames(frames).reduce<ActiveHold[]>((acc, t) => {
			const holeId = placementsMap.get(t.placementId);
			const coord = holeId !== undefined ? holesMap.get(holeId) : undefined;
			if (coord) {
				acc.push({
					cx: coord.x,
					cy: coord.y,
					roleId: t.roleId,
					color: ROLE_COLORS[t.roleId]?.hex ?? '#ffffff'
				});
			}
			return acc;
		}, [])
	);

	// Circle radii in SVG units (~82 px between hold columns in the image)
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
			x="0"
			y="0"
			width={IMG_W}
			height={IMG_H}
			preserveAspectRatio="none"
		/>
		<image
			href="/board-screw-ons.png"
			x="0"
			y="0"
			width={IMG_W}
			height={IMG_H}
			preserveAspectRatio="none"
		/>

		{#each activeHolds as hold (hold.cx + '_' + hold.cy)}
			<circle cx={hold.cx} cy={hold.cy} r={HOLD_R} stroke={hold.color} stroke-width="8" fill="transparent" opacity="0.68" />
		{/each}
	</svg>
</div>
