<script lang="ts">
	/**
	 * ClimbForm — shared form used by both the create and edit climb pages.
	 * Manages all reactive state internally; calls onSave with collected data.
	 */
	import BoardEditor from '$lib/components/BoardEditor.svelte'
	import { connector } from '$lib/connector.svelte'
	import { resolveHolds } from '$lib/data/repository'
	import {
		ALL_ANGLES,
		ALL_GRADES,
		type Angle,
		type Climb,
		gradeToDifficulty
	} from '$lib/data/types'

	interface SavePayload {
		name: string
		description: string
		angle: Angle | null
		difficulty: number | null
		allowMatches: boolean
		isCampus: boolean
		isDraft: boolean
		frames: string
	}

	interface Props {
		title: string
		cancelHref: string
		initialName?: string
		initialDescription?: string
		initialAngle?: Angle | null
		initialGrade?: string | null
		initialAllowMatches?: boolean
		initialIsCampus?: boolean
		initialIsDraft?: boolean
		initialFrames?: string
		onSave: (payload: SavePayload) => void | Promise<void>
	}

	let {
		title,
		cancelHref,
		initialName = '',
		initialDescription = '',
		initialAngle = null,
		initialGrade = null,
		initialAllowMatches = true,
		initialIsCampus = false,
		initialIsDraft = false,
		initialFrames = '',
		onSave
	}: Props = $props()

	// svelte-ignore state_referenced_locally — all initial* props seed state once on mount
	let name = $state(initialName)
	// svelte-ignore state_referenced_locally
	let description = $state(initialDescription)
	// svelte-ignore state_referenced_locally
	let angle = $state<Angle | null>(initialAngle)
	// svelte-ignore state_referenced_locally
	let grade = $state<string | null>(initialGrade)
	// svelte-ignore state_referenced_locally
	let allowMatches = $state(initialAllowMatches)
	// svelte-ignore state_referenced_locally
	let isCampus = $state(initialIsCampus)
	// svelte-ignore state_referenced_locally
	let isDraft = $state(initialIsDraft)
	// svelte-ignore state_referenced_locally
	let frames = $state(initialFrames)
	let saving = $state(false)
	let nameError = $state(false)
	let holdsError = $state(false)

	const holdCount = $derived(frames ? (frames.match(/p\d+r\d+/g) ?? []).length : 0)
	const startCount = $derived(frames ? (frames.match(/r12/g) ?? []).length : 0)
	const finishCount = $derived(frames ? (frames.match(/r14/g) ?? []).length : 0)
	const footCount = $derived(frames ? (frames.match(/r15/g) ?? []).length : 0)

	const holdWarnings = $derived((): string[] => {
		if (holdCount === 0) return []
		const w: string[] = []
		if (startCount === 0) w.push('No start hold set.')
		if (finishCount === 0) w.push('No finish hold set.')
		if (startCount > 2) w.push('More than 2 start holds.')
		if (finishCount > 2) w.push('More than 2 finish holds.')
		if (isCampus && footCount > 0)
			w.push('Campus problem has foot holds — remove them or uncheck Campus.')
		return w
	})

	// When angle is cleared, also clear grade
	$effect(() => {
		if (angle === null) grade = null
	})

	let lighting = $state(false)
	let lightError = $state<string | null>(null)

	async function testOnBoard() {
		if (!frames || !connector.isConnected) return
		lighting = true
		lightError = null
		try {
			// resolveHolds only reads .frames; cast satisfies the type signature.
			const holds = resolveHolds({ frames } as unknown as Climb)
			await connector.lightUpClimb(holds)
		} catch (e) {
			lightError = e instanceof Error ? e.message : String(e)
		} finally {
			lighting = false
		}
	}

	async function handleSave() {
		nameError = !name.trim()
		holdsError = holdCount === 0
		if (nameError || holdsError) return

		saving = true
		try {
			await onSave({
				name: name.trim(),
				description: description.trim(),
				angle,
				difficulty: angle !== null && grade !== null ? gradeToDifficulty(grade) : null,
				allowMatches,
				isCampus,
				isDraft,
				frames
			})
		} finally {
			saving = false
		}
	}
</script>

<main class="mx-auto max-w-2xl space-y-6 px-4 py-6">
	<h1 class="text-xl font-bold text-text">{title}</h1>

	<!-- Name -->
	<div>
		<label for="climb-name" class="mb-1.5 block text-sm font-medium text-text">
			Name <span class="text-red-400">*</span>
		</label>
		<input
			id="climb-name"
			bind:value={name}
			oninput={() => (nameError = false)}
			type="text"
			placeholder="My project…"
			maxlength="100"
			class="w-full rounded-xl border px-3 py-2 text-sm text-text transition focus:outline-none {nameError
				? 'border-red-500 bg-red-500/5'
				: 'border-border bg-surface focus:border-cyan-600'}"
		/>
		{#if nameError}
			<p class="mt-1 text-xs text-red-400">Name is required.</p>
		{/if}
	</div>

	<!-- Angle + Grade row -->
	<div class="grid grid-cols-2 gap-4">
		<div>
			<label for="climb-angle" class="mb-1.5 block text-sm font-medium text-text">
				Angle <span class="text-muted text-xs font-normal">(optional)</span>
			</label>
			<select
				id="climb-angle"
				bind:value={angle}
				class="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-text focus:border-cyan-600 focus:outline-none"
			>
				<option value={null}>Any angle</option>
				{#each ALL_ANGLES as a (a)}
					<option value={a}>{a}°</option>
				{/each}
			</select>
		</div>

		<div>
			<label for="climb-grade" class="mb-1.5 block text-sm font-medium text-text">
				Grade <span class="text-muted text-xs font-normal">(requires angle)</span>
			</label>
			<select
				id="climb-grade"
				bind:value={grade}
				disabled={angle === null}
				class="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-text focus:border-cyan-600 focus:outline-none disabled:cursor-not-allowed disabled:opacity-40"
			>
				<option value={null}>Ungraded</option>
				{#each ALL_GRADES as g (g)}
					<option value={g}>{g}</option>
				{/each}
			</select>
		</div>
	</div>

	<!-- Description -->
	<div>
		<label for="climb-description" class="mb-1.5 block text-sm font-medium text-text">
			Description <span class="text-muted text-xs font-normal">(optional)</span>
		</label>
		<textarea
			id="climb-description"
			bind:value={description}
			rows="3"
			placeholder="Beta, notes, context…"
			maxlength="500"
			class="w-full resize-none rounded-xl border border-border bg-surface px-3 py-2 text-sm text-text focus:border-cyan-600 focus:outline-none"
		></textarea>
	</div>

	<!-- Flags -->
	<div class="space-y-2">
		<p class="text-sm font-medium text-text">Options</p>
		<label class="flex cursor-pointer items-center gap-3">
			<input type="checkbox" bind:checked={allowMatches} class="accent-cyan-500" />
			<span class="text-sm text-text">Matching allowed</span>
		</label>
		<label class="flex cursor-pointer items-center gap-3">
			<input type="checkbox" bind:checked={isCampus} class="accent-cyan-500" />
			<span class="text-sm text-text">Campus (no feet)</span>
		</label>
		<label class="flex cursor-pointer items-center gap-3">
			<input type="checkbox" bind:checked={isDraft} class="accent-cyan-500" />
			<span class="text-sm text-text">Draft (personal only)</span>
		</label>
	</div>

	<!-- Board editor -->
	<div>
		<div class="mb-1.5 flex items-center justify-between">
			<span class="text-sm font-medium text-text">
				Holds <span class="text-red-400">*</span>
			</span>
			<span class="text-xs text-muted">Tap to cycle: Hand → Foot → Start → Finish</span>
		</div>
		{#if holdsError}
			<p class="mb-2 text-xs text-red-400">Place at least one hold.</p>
		{/if}
		<BoardEditor bind:frames />

		<!-- Hold warnings -->
		{#if holdWarnings().length > 0}
			<div class="mt-2 space-y-1">
				{#each holdWarnings() as w (w)}
					<p class="text-xs text-amber-400">⚠ {w}</p>
				{/each}
				<p class="text-xs text-muted">You can still save anyway.</p>
			</div>
		{/if}
	</div>

	<!-- Test on board (only when BLE connected) -->
	{#if connector.isConnected}
		<div class="flex items-center gap-3">
			<button
				onclick={testOnBoard}
				disabled={holdCount === 0 || lighting}
				class="flex items-center gap-2 rounded-xl border border-border bg-surface-raised px-4 py-2.5 text-sm font-semibold text-muted transition hover:border-cyan-600 hover:text-cyan-400 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
			>
				<svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<circle cx="12" cy="12" r="3" /><path
						d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72 1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"
					/>
				</svg>
				{lighting ? 'Lighting…' : 'Test on board'}
			</button>
			{#if lightError}
				<p class="text-xs text-red-400">{lightError}</p>
			{/if}
		</div>
	{/if}

	<!-- Save / Cancel -->
	<div class="flex items-center gap-3 pb-4">
		<button
			onclick={handleSave}
			disabled={saving}
			class="flex-1 rounded-xl bg-cyan-600 py-2.5 text-sm font-semibold text-white transition hover:bg-cyan-500 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
		>
			{saving ? 'Saving…' : title === 'Edit climb' ? 'Save changes' : 'Save climb'}
		</button>
		<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
		<a
			href={cancelHref}
			class="rounded-xl border border-border px-4 py-2.5 text-sm text-muted transition hover:text-text active:scale-95"
		>
			Cancel
		</a>
	</div>
</main>
