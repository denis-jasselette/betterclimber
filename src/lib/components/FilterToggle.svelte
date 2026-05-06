<script lang="ts">
	import type { Snippet } from 'svelte'

	type Color = 'cyan' | 'yellow' | 'purple' | 'blue'

	interface Props {
		active: boolean
		onclick: () => void
		label: string
		color?: Color
		icon: Snippet
	}

	let { active, onclick, label, color = 'cyan', icon }: Props = $props()

	const buttonActive: Record<Color, string> = {
		cyan: 'border-cyan-600 bg-cyan-600/10 text-cyan-300',
		yellow: 'border-yellow-500 bg-yellow-500/10 text-yellow-300',
		purple: 'border-purple-500 bg-purple-500/10 text-purple-300',
		blue: 'border-blue-500 bg-blue-500/10 text-blue-300'
	}

	const indicatorActive: Record<Color, string> = {
		cyan: 'border-cyan-500 bg-cyan-500/20',
		yellow: 'border-yellow-500 bg-yellow-500/20',
		purple: 'border-purple-500 bg-purple-500/20',
		blue: 'border-blue-500 bg-blue-500/20'
	}

	const checkColor: Record<Color, string> = {
		cyan: 'text-cyan-400',
		yellow: 'text-yellow-400',
		purple: 'text-purple-400',
		blue: 'text-blue-400'
	}
</script>

<button
	type="button"
	{onclick}
	class="flex w-full items-center gap-2.5 rounded-lg border px-3 py-2 text-xs font-medium transition active:scale-95 {active
		? buttonActive[color]
		: 'border-border bg-surface-raised/60 text-muted hover:border-border hover:text-text'}"
>
	<span
		class="flex size-5 shrink-0 items-center justify-center rounded-md border {active
			? indicatorActive[color]
			: 'border-border bg-surface-raised'}"
	>
		{#if active}
			<svg
				class="size-3 {checkColor[color]}"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2.5"
			>
				<path d="M5 13l4 4L19 7" />
			</svg>
		{/if}
	</span>
	{@render icon()}
	{label}
</button>
