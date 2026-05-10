<script lang="ts">
	import { SvelteSet } from 'svelte/reactivity'
	import { authClient } from '$lib/auth-client.svelte'
	import TopBar from '$lib/components/TopBar.svelte'
	import {
		formatSessionDate,
		formatSessionDuration,
		formatSessionTime,
		rpeColor,
		rpeLabel
	} from '$lib/data/session-log-utils'

	const session = authClient.useSession()

	// ── Types ─────────────────────────────────────────────────────────────────

	type SessionLogEntry = {
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

	let logs = $state<SessionLogEntry[]>([])
	let loading = $state(true)
	let loadError = $state<string | null>(null)
	// Track which log entries have notes expanded
	const expanded = new SvelteSet<string>()

	// ── Load ──────────────────────────────────────────────────────────────────

	async function loadLogs() {
		loading = true
		loadError = null
		try {
			const res = await fetch('/api/sessions/logs')
			if (res.status === 401) {
				loading = false
				return
			}
			if (!res.ok) throw new Error('Failed to load session history')
			logs = await res.json()
		} catch (e) {
			loadError = e instanceof Error ? e.message : 'Unknown error'
		} finally {
			loading = false
		}
	}

	$effect(() => {
		if ($session.data?.user) {
			loadLogs()
		} else if (!$session.isPending) {
			loading = false
		}
	})

	// ── Helpers ───────────────────────────────────────────────────────────────

	function toggleExpanded(id: string) {
		if (expanded.has(id)) {
			expanded.delete(id)
		} else {
			expanded.add(id)
		}
	}

	async function signIn() {
		await authClient.signIn.social({ provider: 'google', callbackURL: window.location.href })
	}

	// Only show completed logs
	const completedLogs = $derived(logs.filter((l) => l.completed_at !== null))
</script>

<svelte:head>
	<title>Session History — BetterClimber</title>
</svelte:head>

<div class="min-h-screen bg-bg text-text">
	<TopBar hideBoardControls />

	<main class="mx-auto max-w-2xl px-4 py-8">
		<!-- Header -->
		<div class="mb-6 flex items-center gap-4">
			<a
				href="/"
				class="flex size-9 items-center justify-center rounded-xl border border-border bg-surface-raised text-muted transition hover:text-text"
				aria-label="Back"
			>
				<svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M19 12H5M12 19l-7-7 7-7" stroke-linecap="round" stroke-linejoin="round" />
				</svg>
			</a>
			<div>
				<h1 class="text-xl font-bold text-text">Session History</h1>
				<p class="text-sm text-muted">Your completed training sessions</p>
			</div>
		</div>

		<!-- Unauthenticated -->
		{#if !$session.isPending && !$session.data?.user}
			<div class="rounded-2xl border border-border bg-surface p-8 text-center">
				<svg class="mx-auto mb-4 size-12 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
					<path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" stroke-linecap="round" stroke-linejoin="round" />
				</svg>
				<h2 class="mb-2 text-lg font-semibold text-text">Sign in to see your history</h2>
				<p class="mb-6 text-sm text-muted">
					Your session logs are saved to your account. Sign in to view your training history.
				</p>
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
			<div class="space-y-3">
				{#each [1, 2, 3] as i (i)}
					<div class="h-24 animate-pulse rounded-2xl border border-border bg-surface"></div>
				{/each}
			</div>

		<!-- Error -->
		{:else if loadError}
			<div class="rounded-2xl border border-red-500/30 bg-red-500/5 p-6 text-center">
				<p class="text-sm text-red-400">{loadError}</p>
				<button onclick={loadLogs} class="mt-3 text-xs text-muted underline">Retry</button>
			</div>

		<!-- Empty state -->
		{:else if completedLogs.length === 0}
			<div class="rounded-2xl border border-border bg-surface p-8 text-center">
				<svg class="mx-auto mb-4 size-12 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
					<path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" stroke-linecap="round" stroke-linejoin="round" />
				</svg>
				<h2 class="mb-2 text-lg font-semibold text-text">No sessions logged yet</h2>
				<p class="text-sm text-muted">You haven't logged any sessions yet. Start one!</p>
			</div>

		<!-- Log list -->
		{:else}
			<ul class="space-y-3">
				{#each completedLogs as log (log.id)}
					{@const isExpanded = expanded.has(log.id)}
					<li class="rounded-2xl border border-border bg-surface p-4">
						<!-- Header row -->
						<div class="flex items-start justify-between gap-3">
							<div class="min-w-0 flex-1">
								<!-- Session name -->
								<p class="truncate font-semibold text-text">
									{log.template_name ?? 'Unnamed session'}
								</p>
								<!-- Date + duration -->
								<p class="mt-0.5 text-xs text-muted">
									{formatSessionDate(log.started_at)} · {formatSessionTime(log.started_at)}
									· {formatSessionDuration(log.started_at, log.completed_at)}
								</p>
							</div>

							<!-- RPE badge -->
							{#if log.rpe !== null}
								<span
									class="shrink-0 rounded-lg border px-2.5 py-1 text-xs font-bold {rpeColor(log.rpe)}"
									title="RPE {log.rpe} — {rpeLabel(log.rpe)}"
								>
									RPE {log.rpe}
								</span>
							{:else}
								<span class="shrink-0 rounded-lg border border-border px-2.5 py-1 text-xs text-muted">
									No RPE
								</span>
							{/if}
						</div>

						<!-- Notes preview / expand -->
						{#if log.notes}
							<div class="mt-3">
								{#if isExpanded}
									<p class="whitespace-pre-wrap text-sm text-text">{log.notes}</p>
									<button
										onclick={() => toggleExpanded(log.id)}
										class="mt-2 text-xs text-muted underline hover:text-text"
									>
										Show less
									</button>
								{:else}
									<p class="line-clamp-2 text-sm text-muted">{log.notes}</p>
									{#if log.notes.length > 120}
										<button
											onclick={() => toggleExpanded(log.id)}
											class="mt-1 text-xs text-cyan-400 hover:underline"
										>
											Read more
										</button>
									{/if}
								{/if}
							</div>
						{/if}
					</li>
				{/each}
			</ul>
		{/if}
	</main>
</div>
