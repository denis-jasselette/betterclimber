<script lang="ts">
	import { goto } from '$app/navigation'
	import { page } from '$app/state'
	import { type Block, type Exercise, formatDuration, type Template } from '../../session-types'

	// ── Flat exercise list ──────────────────────────────────────────────────────
	// Each item represents one (exercise, series) pair so prev/next moves by series.

	type Step = {
		exercise: Exercise
		block: Block
		blockIndex: number // 0-based
		seriesIndex: number // 0-based, 0..series_count-1
		stepIndex: number // global index in flatSteps array
		totalSteps: number
	}

	// ── State ─────────────────────────────────────────────────────────────────

	let template = $state<Template | null>(null)
	let loading = $state(true)
	let loadError = $state<string | null>(null)

	// Execution
	let flatSteps = $state<Step[]>([])
	let currentStepIndex = $state(0)
	let phase = $state<'exercise' | 'rest' | 'climb-rest' | 'complete'>('exercise')
	// For climb exercises: which climb we're on (0-based)
	let currentClimbIndex = $state(0)

	// Timers
	let timerRemaining = $state(0)
	let timerRunning = $state(false)
	let timerInterval = $state<ReturnType<typeof setInterval> | null>(null)

	// Elapsed tracking
	let sessionStartTime = $state<number>(Date.now())

	// Confirmation to exit
	let confirmExit = $state(false)

	// ── Derived ───────────────────────────────────────────────────────────────

	const currentStep = $derived(flatSteps[currentStepIndex] ?? null)
	const totalStepCount = $derived(flatSteps.length)

	// Progress: 0..1
	const progress = $derived(totalStepCount > 0 ? currentStepIndex / totalStepCount : 0)

	const sessionId = $derived(page.params.id)

	// ── Load template ─────────────────────────────────────────────────────────

	async function loadTemplate(id: string) {
		loading = true
		loadError = null
		try {
			const res = await fetch(`/api/sessions/${id}`)
			if (!res.ok) {
				loadError = res.status === 404 ? 'Session not found' : 'Failed to load session'
				return
			}
			const data: Template = await res.json()
			template = data
			sessionStartTime = Date.now()
			buildFlatSteps(data)
		} catch (e) {
			loadError = e instanceof Error ? e.message : 'Unknown error'
		} finally {
			loading = false
		}
	}

	/** Flatten all blocks → exercises → series into a linear step list */
	function buildFlatSteps(t: Template) {
		const steps: Step[] = []
		let stepIndex = 0

		for (let bi = 0; bi < t.blocks.length; bi++) {
			const block = t.blocks[bi]
			for (const exercise of block.exercises) {
				for (let si = 0; si < exercise.series_count; si++) {
					steps.push({
						exercise,
						block,
						blockIndex: bi,
						seriesIndex: si,
						stepIndex,
						totalSteps: 0 // filled below
					})
					stepIndex++
				}
			}
		}

		// Fill totalSteps
		for (const step of steps) {
			step.totalSteps = steps.length
		}

		flatSteps = steps
		currentStepIndex = 0
		phase = 'exercise'
		currentClimbIndex = 0
		initExercise(steps[0] ?? null)
	}

	$effect(() => {
		const id = sessionId
		if (id) loadTemplate(id)
	})

	// ── Timer logic ───────────────────────────────────────────────────────────

	function clearTimer() {
		if (timerInterval !== null) {
			clearInterval(timerInterval)
			timerInterval = null
		}
		timerRunning = false
	}

	function startTimer(seconds: number, onDone: () => void) {
		clearTimer()
		timerRemaining = seconds
		timerRunning = true
		timerInterval = setInterval(() => {
			timerRemaining -= 1
			if (timerRemaining <= 0) {
				clearTimer()
				onDone()
			}
		}, 1000)
	}

	// ── Lifecycle ─────────────────────────────────────────────────────────────

	/** Set up state when entering an exercise (phase = 'exercise') */
	function initExercise(step: Step | null) {
		if (!step) return
		clearTimer()
		phase = 'exercise'
		currentClimbIndex = 0

		if (step.exercise.type === 'timed' && step.exercise.duration_s != null) {
			startTimer(step.exercise.duration_s, advanceToRest)
		}
	}

	/** Called when exercise is done — start rest or go to next step */
	function advanceToRest() {
		const step = flatSteps[currentStepIndex]
		if (!step) return

		const restSeconds = step.exercise.rest_s ?? 0
		if (restSeconds > 0) {
			clearTimer()
			phase = 'rest'
			startTimer(restSeconds, advanceStep)
		} else {
			advanceStep()
		}
	}

	/** Move to next step */
	function advanceStep() {
		clearTimer()
		const nextIndex = currentStepIndex + 1
		if (nextIndex >= flatSteps.length) {
			phase = 'complete'
			return
		}
		currentStepIndex = nextIndex
		phase = 'exercise'
		initExercise(flatSteps[nextIndex])
	}

	/** Go back one step */
	function goBack() {
		if (currentStepIndex === 0) return
		clearTimer()
		currentStepIndex -= 1
		phase = 'exercise'
		initExercise(flatSteps[currentStepIndex])
	}

	/** Skip rest — advance immediately */
	function skipRest() {
		clearTimer()
		advanceStep()
	}

	// ── Climb exercise helpers ────────────────────────────────────────────────

	function nextClimb() {
		const step = flatSteps[currentStepIndex]
		if (!step) return
		const climbCount = step.exercise.climb_count ?? 1

		if (currentClimbIndex + 1 < climbCount) {
			clearTimer()
			currentClimbIndex += 1

			// Rest between climbs if set
			const restBetween = step.exercise.rest_between_climbs_s ?? 0
			if (restBetween > 0) {
				phase = 'climb-rest'
				startTimer(restBetween, () => {
					phase = 'exercise'
					// Re-init climb timer if duration set
					if (step.exercise.duration_per_climb_s != null) {
						startTimer(step.exercise.duration_per_climb_s, () => {
							// Done this climb — nothing, user taps "Next climb" or "Done"
						})
					}
				})
			} else {
				phase = 'exercise'
				if (step.exercise.duration_per_climb_s != null) {
					startTimer(step.exercise.duration_per_climb_s, () => {})
				}
			}
		} else {
			// All climbs done — go to rest
			advanceToRest()
		}
	}

	// ── Formatting ────────────────────────────────────────────────────────────

	function formatTime(s: number): string {
		const m = Math.floor(s / 60)
		const sec = s % 60
		return `${m}:${String(sec).padStart(2, '0')}`
	}

	function elapsedLabel(): string {
		const elapsed = Math.floor((Date.now() - sessionStartTime) / 1000)
		return formatDuration(elapsed)
	}

	// ── Action handler for exercise "Done" button ─────────────────────────────

	function handleDone() {
		const step = flatSteps[currentStepIndex]
		if (!step) return

		if (step.exercise.type === 'climb') {
			const climbCount = step.exercise.climb_count ?? 1
			if (currentClimbIndex + 1 < climbCount) {
				nextClimb()
			} else {
				advanceToRest()
			}
		} else {
			advanceToRest()
		}
	}

	// ── Cleanup on destroy ────────────────────────────────────────────────────

	$effect(() => {
		return () => {
			clearTimer()
		}
	})
</script>

<svelte:head>
	<title>Running Session — BetterClimber</title>
</svelte:head>

<div class="flex min-h-screen flex-col bg-bg text-text">
	<!-- ── Top bar: progress + exit ────────────────────────────────────────── -->
	<header class="flex shrink-0 items-center gap-3 px-4 py-3">
		<!-- Exit button -->
		{#if !confirmExit && phase !== 'complete'}
			<button
				type="button"
				aria-label="Exit session"
				onclick={() => (confirmExit = true)}
				class="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border bg-surface text-muted transition hover:border-red-500/40 hover:text-red-400 active:scale-95"
			>
				<svg class="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
					<path d="M18 6L6 18M6 6l12 12" />
				</svg>
			</button>
		{:else if confirmExit}
			<div class="flex items-center gap-2">
				<span class="text-sm text-muted">Exit session?</span>
				<button
					type="button"
					onclick={() => goto(`/sessions/${sessionId}`)}
					class="rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-sm font-semibold text-red-400 active:scale-95"
				>
					Exit
				</button>
				<button
					type="button"
					onclick={() => (confirmExit = false)}
					class="rounded-xl border border-border px-3 py-1.5 text-sm text-muted active:scale-95"
				>
					Cancel
				</button>
			</div>
		{/if}

		<!-- Progress bar -->
		{#if phase !== 'complete'}
			<div class="relative h-2 flex-1 overflow-hidden rounded-full bg-surface">
				<div
					class="absolute inset-y-0 left-0 rounded-full bg-cyan-500 transition-all duration-300"
					style="width: {progress * 100}%"
					role="progressbar"
					aria-valuenow={Math.round(progress * 100)}
					aria-valuemin={0}
					aria-valuemax={100}
				></div>
			</div>
			<span class="shrink-0 text-xs text-muted tabular-nums">
				{currentStepIndex + 1}/{totalStepCount}
			</span>
		{/if}
	</header>

	<!-- ── Main content ────────────────────────────────────────────────────── -->
	<main class="flex flex-1 flex-col items-center justify-center px-6 py-8">

		{#if loading}
			<!-- Loading skeleton -->
			<div class="w-full max-w-sm space-y-4 text-center">
				<div class="mx-auto h-4 w-32 animate-pulse rounded-lg bg-surface"></div>
				<div class="mx-auto h-12 w-64 animate-pulse rounded-xl bg-surface"></div>
				<div class="mx-auto h-24 w-24 animate-pulse rounded-full bg-surface"></div>
			</div>

		{:else if loadError}
			<div class="rounded-2xl border border-red-500/30 bg-red-500/5 p-8 text-center">
				<p class="mb-4 text-sm text-red-400">{loadError}</p>
				<a href="/sessions" class="text-sm text-muted underline">Back to sessions</a>
			</div>

		{:else if phase === 'complete'}
			<!-- ── Session complete ───────────────────────────────────────────── -->
			<div class="w-full max-w-sm space-y-6 text-center">
				<div class="text-6xl" aria-hidden="true">🎉</div>
				<div>
					<h1 class="text-3xl font-bold text-text">Session complete!</h1>
					<p class="mt-2 text-sm text-muted">Duration: {elapsedLabel()}</p>
				</div>

				<div class="flex flex-col gap-3">
					<a
						href="/sessions/history"
						class="flex w-full items-center justify-center gap-2 rounded-2xl bg-cyan-600 py-4 text-base font-semibold text-white transition hover:bg-cyan-500 active:scale-[0.99]"
					>
						<svg class="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
							<path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5" />
							<path d="M15.5 3.5a2.121 2.121 0 013 3L12 13l-4 1 1-4 9.5-9.5z" />
						</svg>
						Log this session
					</a>
					<a
						href={`/sessions/${sessionId}`}
						class="flex w-full items-center justify-center rounded-2xl border border-border bg-surface py-4 text-base font-semibold text-muted transition hover:text-text active:scale-[0.99]"
					>
						Done
					</a>
				</div>
			</div>

		{:else if phase === 'rest' && currentStep}
			<!-- ── Rest view ──────────────────────────────────────────────────── -->
			<div class="w-full max-w-sm space-y-8 text-center">
				<div>
					<p class="text-sm font-medium uppercase tracking-widest text-muted">Rest</p>
				</div>

				<!-- Countdown -->
				<div
					class="mx-auto flex size-48 items-center justify-center rounded-full border-4 border-cyan-600/30 bg-surface text-6xl font-bold tabular-nums text-cyan-300"
				>
					{formatTime(timerRemaining)}
				</div>

				<!-- What's next -->
				{#if currentStepIndex + 1 < flatSteps.length}
					{@const nextStep = flatSteps[currentStepIndex + 1]}
					<p class="text-sm text-muted">
						Up next: <span class="font-medium text-text">{nextStep.exercise.name}</span>
					</p>
				{/if}

				<!-- Skip rest -->
				<button
					type="button"
					onclick={skipRest}
					class="mx-auto flex items-center gap-1.5 rounded-xl border border-border px-4 py-2 text-sm text-muted transition hover:border-border hover:text-text active:scale-95"
				>
					Skip rest
					<svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
						<polyline points="13 17 18 12 13 7" />
						<polyline points="6 17 11 12 6 7" />
					</svg>
				</button>
			</div>

		{:else if phase === 'climb-rest' && currentStep}
			<!-- ── Between-climb rest ─────────────────────────────────────────── -->
			<div class="w-full max-w-sm space-y-8 text-center">
				<div>
					<p class="text-xs font-medium uppercase tracking-widest text-muted">
						{currentStep.block.name} · Block {currentStep.blockIndex + 1} of {template?.blocks.length ?? 1}
					</p>
					<p class="mt-1 text-sm text-muted">Between climbs</p>
				</div>

				<div class="mx-auto flex size-48 items-center justify-center rounded-full border-4 border-orange-500/30 bg-surface text-6xl font-bold tabular-nums text-orange-300">
					{formatTime(timerRemaining)}
				</div>

				<p class="text-sm text-muted">
					Climb {currentClimbIndex + 1} of {currentStep.exercise.climb_count ?? 1} — rest before next
				</p>
			</div>

		{:else if currentStep}
			<!-- ── Exercise view ──────────────────────────────────────────────── -->
			{@const ex = currentStep.exercise}
			<div class="w-full max-w-sm space-y-6">

				<!-- Block / series header -->
				<div class="text-center">
					<p class="text-xs font-medium uppercase tracking-widest text-muted">
						{currentStep.block.name} · Block {currentStep.blockIndex + 1} of {template?.blocks.length ?? 1}
					</p>
					<p class="mt-1 text-xs text-muted">
						Series {currentStep.seriesIndex + 1} of {ex.series_count}
					</p>
				</div>

				<!-- Exercise name -->
				<div class="text-center">
					<h1 class="text-3xl font-bold leading-tight text-text">{ex.name}</h1>
					{#if ex.description}
						<p class="mt-3 text-sm leading-relaxed text-muted">{ex.description}</p>
					{/if}
				</div>

				<!-- Action area -->
				{#if ex.type === 'reps'}
					<!-- Reps display -->
					<div class="flex flex-col items-center gap-6">
						<div class="flex size-40 items-center justify-center rounded-full border-4 border-green-500/30 bg-surface">
							<span class="text-5xl font-bold text-green-300">×{ex.reps ?? 0}</span>
						</div>
						<button
							type="button"
							onclick={handleDone}
							class="w-full rounded-2xl bg-green-600 py-5 text-xl font-bold text-white transition hover:bg-green-500 active:scale-[0.99]"
						>
							Done
						</button>
					</div>

				{:else if ex.type === 'timed'}
					<!-- Timed countdown -->
					<div class="flex flex-col items-center gap-6">
						<div
							class="flex size-48 items-center justify-center rounded-full border-4 border-blue-500/30 bg-surface text-6xl font-bold tabular-nums {timerRemaining <= 5 ? 'text-red-300' : 'text-blue-300'}"
						>
							{formatTime(timerRemaining)}
						</div>
						<button
							type="button"
							onclick={handleDone}
							class="w-full rounded-2xl border border-border bg-surface py-4 text-base font-semibold text-muted transition hover:text-text active:scale-[0.99]"
						>
							Skip
						</button>
					</div>

				{:else if ex.type === 'climb'}
					<!-- Climb exercise -->
					<div class="flex flex-col items-center gap-6">
						<!-- Grade ref badge -->
						{#if ex.grade_ref}
							<span class="inline-flex items-center gap-1.5 rounded-full border border-orange-500/30 bg-orange-500/10 px-4 py-1.5 text-sm font-semibold text-orange-300">
								<svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
									<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
								</svg>
								{ex.grade_ref}
							</span>
						{/if}

						<!-- Climb counter -->
						<div class="flex size-40 items-center justify-center rounded-full border-4 border-orange-500/30 bg-surface">
							<div class="text-center">
								<p class="text-3xl font-bold text-orange-300">{currentClimbIndex + 1}</p>
								<p class="text-xs text-muted">of {ex.climb_count ?? 1}</p>
							</div>
						</div>

						<!-- Per-climb countdown (if set) -->
						{#if ex.duration_per_climb_s != null && timerRunning}
							<div class="text-center">
								<p class="text-xs text-muted">Time remaining</p>
								<p class="text-2xl font-bold tabular-nums {timerRemaining <= 10 ? 'text-red-300' : 'text-text'}">
									{formatTime(timerRemaining)}
								</p>
							</div>
						{/if}

						<!-- Action -->
						{#if (ex.climb_count ?? 1) > 1 && currentClimbIndex + 1 < (ex.climb_count ?? 1)}
							<button
								type="button"
								onclick={nextClimb}
								class="w-full rounded-2xl bg-orange-600 py-5 text-xl font-bold text-white transition hover:bg-orange-500 active:scale-[0.99]"
							>
								Next climb
							</button>
						{:else}
							<button
								type="button"
								onclick={handleDone}
								class="w-full rounded-2xl bg-orange-600 py-5 text-xl font-bold text-white transition hover:bg-orange-500 active:scale-[0.99]"
							>
								Done
							</button>
						{/if}
					</div>
				{/if}
			</div>
		{/if}
	</main>

	<!-- ── Navigation footer (prev / next) ────────────────────────────────── -->
	{#if !loading && !loadError && phase !== 'complete'}
		<footer class="flex shrink-0 gap-3 px-4 py-4">
			<button
				type="button"
				onclick={goBack}
				disabled={currentStepIndex === 0}
				class="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-border bg-surface py-4 text-sm font-semibold text-muted transition hover:text-text disabled:opacity-30 active:scale-[0.99]"
			>
				<svg class="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
					<polyline points="15 18 9 12 15 6" />
				</svg>
				Prev
			</button>
			<button
				type="button"
				onclick={() => {
					if (phase === 'rest') {
						skipRest()
					} else {
						handleDone()
					}
				}}
				class="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-border bg-surface py-4 text-sm font-semibold text-muted transition hover:text-text active:scale-[0.99]"
			>
				Next
				<svg class="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
					<polyline points="9 18 15 12 9 6" />
				</svg>
			</button>
		</footer>
	{/if}
</div>
