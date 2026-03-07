<script lang="ts">
	import { browser } from '$app/environment';
	import { ALL_GRADES, formatGrade } from '$lib/data/types';
	import { settings } from '$lib/settings-store.svelte';

	let {
		gradeMin = $bindable(),
		gradeMax = $bindable()
	}: {
		gradeMin: string | null;
		gradeMax: string | null;
	} = $props();

	const grades = ALL_GRADES;
	const max = grades.length - 1;

	// Work in index-space: 0..max
	let values = $state([
		gradeMin !== null ? grades.indexOf(gradeMin) : 0,
		gradeMax !== null ? grades.indexOf(gradeMax) : max
	]);

	let updatingFromSlider = false;

	// Propagate slider changes back to the bindable props
	function onSliderChange(e: CustomEvent<{ values: number[] }>) {
		updatingFromSlider = true;
		const [lo, hi] = e.detail.values;
		gradeMin = lo === 0 ? null : grades[lo];
		gradeMax = hi === max ? null : grades[hi];
		updatingFromSlider = false;
	}

	// Sync inward when props are reset externally (e.g. "Clear filters")
	$effect(() => {
		if (updatingFromSlider) return;
		const lo = gradeMin !== null ? grades.indexOf(gradeMin) : 0;
		const hi = gradeMax !== null ? grades.indexOf(gradeMax) : max;
		if (lo !== values[0] || hi !== values[1]) {
			values = [lo, hi];
		}
	});

	const label = $derived(() => {
		const lo = formatGrade(grades[values[0]], settings.gradingSystem);
		const hi = formatGrade(grades[values[1]], settings.gradingSystem);
		if (values[0] === 0 && values[1] === max) return 'Any grade';
		if (values[0] === values[1]) return lo;
		return `${lo} – ${hi}`;
	});

	const formatter = $derived((_v: number) =>
		formatGrade(grades[_v] ?? String(_v), settings.gradingSystem)
	);

	// Dynamic import — only on the client. The library registers a custom element
	// at module level using HTMLElement which does not exist in the SSR runtime.
	let RangeSlider: typeof import('svelte-range-slider-pips').RangeSlider | undefined =
		$state(undefined);
	if (browser) {
		import('svelte-range-slider-pips').then((m) => {
			RangeSlider = m.RangeSlider;
		});
	}
</script>

<div class="space-y-2">
	<div class="flex items-center justify-between">
		<p class="text-xs font-semibold tracking-wider text-muted uppercase">Grade</p>
		<span class="text-xs font-semibold text-text/80">{label()}</span>
	</div>

	<div class="grade-slider">
		{#if RangeSlider}
			<RangeSlider
				bind:values
				min={0}
				{max}
				step={1}
				range={true}
				float={true}
				{formatter}
				on:change={onSliderChange}
			/>
		{:else}
			<!-- SSR / pre-hydration placeholder keeps layout stable -->
			<div class="h-5 w-full rounded-full bg-border"></div>
		{/if}
	</div>

	<div class="flex justify-between text-[10px] text-muted">
		<span>{formatGrade(grades[0], settings.gradingSystem)}</span>
		<span>{formatGrade(grades[max], settings.gradingSystem)}</span>
	</div>
</div>

<style>
	.grade-slider {
		--range-slider: var(--color-border);
		--range-handle-inactive: #06b6d4;
		--range-handle: #22d3ee;
		--range-handle-focus: #22d3ee;
		--range-range: #0891b2;
		--range-float-inactive: var(--color-border);
		--range-float: #0891b2;
		--range-float-text: #ffffff;
		font-size: 14px;
	}
</style>
