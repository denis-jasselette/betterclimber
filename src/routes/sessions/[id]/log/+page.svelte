<script lang="ts">
	import { goto } from '$app/navigation'
	import { page } from '$app/state'
	import { authClient } from '$lib/auth-client.svelte'
	import TopBar from '$lib/components/TopBar.svelte'
	import {
		formatSessionDuration,
		formatSessionTime,
		rpeTrackColor
	} from '$lib/data/session-log-utils'

	const session = authClient.useSession()

	// ── Types ─────────────────────────────────────────────────────────────────

	type SessionLog = {
		id: string
		user_id: string
		template_id: string | null
		template_name: string | null
		started_at: string
		completed_at: string | null
		rpe: number | null
		notes: string | null
	}

	// ── State ─────────────────────────────────────────────────────────────────

	const logId = $derived(page.params.id)

	let log = $state<SessionLog | null>(null)
	let loading = $state(true)
	let loadError = $state<string | null>(null)

	let rpe = $state<number>(5)
	let notes = $state('')
	let saving = $state(false)
	let saveError = $state<string | null>(null)

	// RPE scale labels
	const RPE_LABELS: Record<number, string> = {
		1: 'Very easy',
		2: 'Easy',
		3: 'Easy',
		4: 'Moderate',
		5: 'Moderate',
		6: 'Somewhat hard',
		7: 'Hard',
		8: 'Hard',
		9: 'Very hard',
		10: 'Maximal effort'
	}

	// ── Load log entry ────────────────────────────────────────────────────────

	async function loadLog(id: string) {
		loading = true
		loadError = null
		try {
			// Fetch via the GET /api/sessions/logs endpoint (returns all user's logs)
			// and find the one matching id
			const res = await fetch('/api/sessions/logs')
			if (!res.ok) {
				loadError = res.status === 401 ? 'Authentication required' : 'Failed to load session'
				loading = false
				return
			}
			const all: SessionLog[] = await res.json()
			const found = all.find((l) => l.id === id) ?? null
			if (!found) {
				loadError = 'Session log not found'
				loading = false
				return
			}
			log = found
			// Pre-fill values if already set
			if (found.rpe !== null) rpe = found.rpe
			if (found.notes) notes = found.notes
		} catch (e) {
			loadError = e instanceof Error ? e.message : 'Unknown error'
		} finally {
			loading = false
		}
	}

	$effect(() => {
		if ($session.data?.user && logId) {
			loadLog(logId)
		} else if (!$session.isPending) {
			loading = false
		}
	})

	// ── Helpers ───────────────────────────────────────────────────────────────

	function formatDate(iso: string): string {
		return new Date(iso).toLocaleDateString(undefined, {
			weekday: 'long',
			month: 'long',
			day: 'numeric',
			year: 'numeric'
		})
	}

	// ── Actions ───────────────────────────────────────────────────────────────

	async function save() {
		if (!log) return
		saving = true
		saveError = null
		try {
			const res = await fetch(`/api/sessions/logs/${log.id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					completed_at: log.completed_at ?? new Date().toISOString(),
					rpe,
					notes: notes.trim() || null
				})
			})
			if (!res.ok) {
				const data = await res.json().catch(() => ({}))
				saveError = data.message ?? 'Failed to save log'
				return
			}
			await goto('/sessions/history')
		} catch (e) {
			saveError = e instanceof Error ? e.message : 'Unknown error'
		} finally {
			saving = false
		}
	}

	async function skip() {
		await goto('/sessions/history')
	}

	async function signIn() {
		await authClient.signIn.social({ provider: 'google', callbackURL: window.location.href })
	}
</script>

<svelte:head>
	<title>Log Session — BetterClimber</title>
</svelte:head>

<div class="min-h-screen bg-bg text-text">
	<TopBar hideBoardControls />

	<main class="mx-auto max-w-lg px-4 py-8">
		<!-- Header -->
		<div class="mb-8 flex items-center gap-4">
			<a
				href="/sessions/history"
				class="flex size-9 items-center justify-center rounded-xl border border-border bg-surface-raised text-muted transition hover:text-text"
				aria-label="Back to history"
			>
				<svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M19 12H5M12 19l-7-7 7-7" stroke-linecap="round" stroke-linejoin="round" />
				</svg>
			</a>
			<h1 class="text-xl font-bold text-text">Log this session</h1>
		</div>

		<!-- Unauthenticated -->
		{#if !$session.isPending && !$session.data?.user}
			<div class="rounded-2xl border border-border bg-surface p-8 text-center">
				<h2 class="mb-2 text-lg font-semibold text-text">Sign in to log sessions</h2>
				<p class="mb-6 text-sm text-muted">Sign in to save your session logs and view your history.</p>
				<button
					onclick={signIn}
					class="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-5 py-2.5 text-sm font-medium text-text transition hover:border-cyan-600/60 hover:bg-cyan-600/5 active:scale-[0.99]"
				>
					<svg viewBox="0 0 24 24" class="size-4" aria-hidden="true">
						<path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
						<path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
						<path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
						<path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
					</svg>
					Sign in with Google
				</button>
			</div>

		<!-- Loading -->
		{:else if loading}
			<div class="space-y-4">
				<div class="h-20 animate-pulse rounded-2xl border border-border bg-surface"></div>
				<div class="h-32 animate-pulse rounded-2xl border border-border bg-surface"></div>
				<div class="h-28 animate-pulse rounded-2xl border border-border bg-surface"></div>
			</div>

		<!-- Error -->
		{:else if loadError}
			<div class="rounded-2xl border border-red-500/30 bg-red-500/5 p-6 text-center">
				<p class="text-sm text-red-400">{loadError}</p>
				{#if logId}
					<button onclick={() => loadLog(logId)} class="mt-3 text-xs text-muted underline">Retry</button>
				{/if}
			</div>

		<!-- Log form -->
		{:else if log}
			<!-- Session info -->
			<div class="mb-6 rounded-2xl border border-border bg-surface p-5">
				<p class="text-lg font-bold text-text">{log.template_name ?? 'Training session'}</p>
				<p class="mt-1 text-sm text-muted">
					{formatDate(log.started_at)} at {formatSessionTime(log.started_at)}
					{#if log.completed_at}
						· {formatSessionDuration(log.started_at, log.completed_at)}
					{/if}
				</p>
			</div>

			<!-- RPE slider -->
			<div class="mb-6 rounded-2xl border border-border bg-surface p-5">
				<div class="mb-4 flex items-baseline justify-between">
					<label for="rpe-slider" class="text-sm font-semibold text-text">
						How hard was it?
					</label>
					<span class="text-xs text-muted">RPE (Rate of Perceived Exertion)</span>
				</div>

				<!-- Value display -->
				<div class="mb-4 text-center">
					<span
						class="text-4xl font-black tabular-nums"
						style="color: {rpeTrackColor(rpe)}"
					>{rpe}</span>
					<span class="ml-2 text-sm text-muted">/ 10</span>
					<p class="mt-1 text-sm text-muted">{RPE_LABELS[rpe]}</p>
				</div>

				<!-- Slider -->
				<div class="px-1">
					<input
						id="rpe-slider"
						type="range"
						min="1"
						max="10"
						step="1"
						bind:value={rpe}
						class="w-full cursor-pointer appearance-none rounded-full bg-surface-raised"
						style="accent-color: {rpeTrackColor(rpe)}"
					/>
					<div class="mt-2 flex justify-between text-xs text-muted">
						<span>1 — Very easy</span>
						<span>10 — Maximal</span>
					</div>
				</div>

				<!-- Scale labels at key points -->
				<div class="mt-3 grid grid-cols-5 gap-1 text-center text-xs text-muted">
					<span>1–2<br /><span class="text-emerald-400">Easy</span></span>
					<span>3–4<br /><span class="text-cyan-400">Light</span></span>
					<span>5–6<br /><span class="text-cyan-300">Mod.</span></span>
					<span>7–8<br /><span class="text-amber-400">Hard</span></span>
					<span>9–10<br /><span class="text-red-400">Max</span></span>
				</div>
			</div>

			<!-- Notes -->
			<div class="mb-6 rounded-2xl border border-border bg-surface p-5">
				<label for="notes-field" class="mb-3 block text-sm font-semibold text-text">
					Notes <span class="font-normal text-muted">(optional)</span>
				</label>
				<textarea
					id="notes-field"
					bind:value={notes}
					placeholder="How did it go?"
					rows="4"
					maxlength="2000"
					class="w-full resize-none rounded-xl border border-border bg-surface-raised px-3 py-2.5 text-sm text-text placeholder:text-muted focus:border-cyan-600/60 focus:outline-none"
				></textarea>
				<p class="mt-1 text-right text-xs text-muted">{notes.length}/2000</p>
			</div>

			<!-- Save error -->
			{#if saveError}
				<p class="mb-4 text-sm text-red-400">{saveError}</p>
			{/if}

			<!-- Actions -->
			<div class="flex gap-3">
				<button
					onclick={save}
					disabled={saving}
					class="flex-1 rounded-xl border border-cyan-600/50 bg-cyan-600/10 px-5 py-3 text-sm font-semibold text-cyan-400 transition hover:bg-cyan-600/20 active:scale-[0.98] disabled:opacity-50"
				>
					{saving ? 'Saving…' : 'Save'}
				</button>
				<button
					onclick={skip}
					disabled={saving}
					class="rounded-xl border border-border px-5 py-3 text-sm text-muted transition hover:text-text active:scale-[0.98] disabled:opacity-50"
				>
					Skip
				</button>
			</div>
		{/if}
	</main>
</div>
