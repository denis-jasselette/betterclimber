<script lang="ts">
	import { goto } from '$app/navigation'
	import BoardEditor from '$lib/components/BoardEditor.svelte'
	import TopBar from '$lib/components/TopBar.svelte'
	import { saveCustomClimb } from '$lib/data/custom-climbs'
	import { ALL_ANGLES, type Angle } from '$lib/data/types'

	let name = $state('')
	let description = $state('')
	let angle = $state<Angle | null>(null)
	let frames = $state('')
	let saving = $state(false)
	let nameError = $state(false)
	let holdsError = $state(false)

	const holdCount = $derived(frames ? (frames.match(/p\d+r\d+/g) ?? []).length : 0)

	async function handleSave() {
		nameError = !name.trim()
		holdsError = holdCount === 0
		if (nameError || holdsError) return

		saving = true
		const uuid = crypto.randomUUID()
		saveCustomClimb({
			uuid,
			name: name.trim(),
			description: description.trim(),
			frames,
			angle,
			createdAt: new Date().toISOString()
		})
		const dest = angle !== null ? `/climb/${uuid}?angle=${angle}` : `/climb/${uuid}`
		// eslint-disable-next-line svelte/no-navigation-without-resolve
		await goto(dest)
	}
</script>

<div class="min-h-screen bg-bg">
	<TopBar>
		<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
		<a
			href="/"
			class="flex h-9 items-center gap-1.5 rounded-xl border border-border bg-surface-raised px-3 text-sm text-muted transition hover:text-text active:scale-95"
		>
			Cancel
		</a>
	</TopBar>

	<main class="mx-auto max-w-2xl px-4 py-6 space-y-6">
		<h1 class="text-xl font-bold text-text">Create custom climb</h1>

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

		<!-- Angle -->
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

		<!-- Board editor -->
		<div>
			<div class="mb-1.5 flex items-center justify-between">
				<span class="text-sm font-medium text-text">
					Holds <span class="text-red-400">*</span>
				</span>
				<span class="text-xs text-muted">Tap to cycle: Start → Hand → Foot → Finish</span>
			</div>
			{#if holdsError}
				<p class="mb-2 text-xs text-red-400">Place at least one hold.</p>
			{/if}
			<BoardEditor bind:frames />
		</div>

		<!-- Save -->
		<div class="flex items-center gap-3 pb-4">
			<button
				onclick={handleSave}
				disabled={saving}
				class="flex-1 rounded-xl bg-cyan-600 py-2.5 text-sm font-semibold text-white transition hover:bg-cyan-500 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
			>
				{saving ? 'Saving…' : 'Save climb'}
			</button>
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
			<a
				href="/"
				class="rounded-xl border border-border px-4 py-2.5 text-sm text-muted transition hover:text-text active:scale-95"
			>
				Cancel
			</a>
		</div>
	</main>
</div>
