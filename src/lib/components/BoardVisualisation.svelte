<script lang="ts">
	/**
	 * BoardVisualisation
	 *
	 * Renders the Kilter Board (16×12 Original Full Kit) with the real hold images as
	 * the background, then overlays coloured circles on the holds used by a climb.
	 */

	import BoardBoltOns from '$lib/assets/board-bolt-ons.png'
	import BoardScrewOns from '$lib/assets/board-screw-ons.png'
	import { resolveFrames } from '$lib/data/frames-parser'
	import { isRoleId, isSetId, ROLE_COLORS, SET_RADII } from '$lib/data/types'

	interface Props {
		frames: string
	}

	const { frames }: Props = $props()

	const IMG_W = 1477 // original image width  (landscape)
	const IMG_H = 1200 // original image height (landscape)

	// Pixel calibration constants derived from the board image dimensions:
	// The hold x/y coordinates in the DB are in board-space units (roughly inches).
	// xScale/yScale convert units → pixels; xOffset/yOffset shift the origin to
	// match the image crop. yScale is negative because the DB y-axis points up,
	// while SVG y-axis points down.
	function transformX(x: number) {
		const xScale = 7.6
		const xOffset = 190.4
		return x * xScale + xOffset
	}

	function transformY(y: number) {
		const yScale = -7.7
		const yOffset = 1198.5
		return y * yScale + yOffset
	}

	const activeHolds = $derived(
		resolveFrames(frames).map((hold) => ({
			placementId: hold.placement.id,
			cx: transformX(hold.hole.x),
			cy: transformY(hold.hole.y),
			radius: isSetId(hold.placement.set_id) ? SET_RADII[hold.placement.set_id] : 32,
			color: isRoleId(hold.roleId) ? ROLE_COLORS[hold.roleId].hex : '#ffffff'
		}))
	)
</script>

<div class="w-full rounded-2xl border border-border bg-zinc-950" aria-label="Board visualisation">
	<svg
		viewBox="0 0 {IMG_W} {IMG_H}"
		xmlns="http://www.w3.org/2000/svg"
		class="w-full"
		role="img"
		aria-label="Kilter Board hold map"
	>
		<image
			href={BoardBoltOns}
			width={IMG_W}
			height={IMG_H}
		/>
		<image
			href={BoardScrewOns}
			width={IMG_W}
			height={IMG_H}
		/>

		{#each activeHolds as hold (hold.placementId)}
			<circle
				cx={hold.cx}
				cy={hold.cy}
				r={hold.radius}
				stroke={hold.color}
				stroke-width="8"
				fill="transparent"
				opacity="0.68"
			/>
		{/each}
	</svg>
</div>
