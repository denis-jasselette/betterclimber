<script lang="ts">
import { resolve } from '$app/paths'
import { connector } from '$lib/connector.svelte'
import { resolveHolds } from '$lib/data/repository'
import type { Climb } from '$lib/data/types'

type TestPattern = 'row1' | 'row2' | 'diagonal' | 'custom'

let selectedPattern: TestPattern = $state('row1')
let customFrames = $state('')
let sending = $state(false)

const patternPresets: Record<Exclude<TestPattern, 'custom'>, { label: string; frames: string }> = {
	row1: { label: 'Row 1 (bottom)', frames: 'p1447r13p1073r13p1448r13p1074r13' },
	row2: { label: 'Row 2', frames: 'p1454r13p1080r13p1455r13p1081r13' },
	diagonal: { label: 'Diagonal', frames: 'p1447r13p1455r13p1463r13p1519r13' }
}

async function sendTestPattern() {
	if (!connector.isConnected || sending) return
	sending = true

	try {
		let frames: string
		if (selectedPattern === 'custom') {
			frames = customFrames.trim()
			if (!frames) {
				connector.log('warn', 'Please enter frames string')
				return
			}
		} else {
			frames = patternPresets[selectedPattern].frames
		}

		connector.log('info', `Sending test pattern: ${frames}`)

		const climb: Climb = {
			uuid: 'test-pattern',
			layout_id: 1,
			setter_id: 0,
			setter_username: 'debug',
			name: 'Test Pattern',
			description: '',
			frames,
			frames_count: 1,
			angle: null,
			is_draft: false,
			allow_matches: true,
			is_campus: false,
			is_route: false
		}

		const holds = await resolveHolds(climb)
		connector.log('debug', `Resolved ${holds.length} hold(s)`)
		if (holds.length === 0) {
			connector.log('warn', 'No holds resolved — check placement IDs')
			return
		}
		await connector.lightUpClimb(holds)
	} catch (err) {
		connector.log('error', `Failed to send: ${err instanceof Error ? err.message : String(err)}`)
	} finally {
		sending = false
	}
}

async function sendClear() {
	if (!connector.isConnected) return
	try {
		await connector.clear()
	} catch (err) {
		connector.log('error', `Failed to clear: ${err instanceof Error ? err.message : String(err)}`)
	}
}

function formatTime(ts: number): string {
	const date = new Date(ts)
	return date.toLocaleTimeString('en-US', {
		hour12: false,
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit'
	})
}

function getLevelClass(level: string): string {
	switch (level) {
		case 'error':
			return 'text-red-400'
		case 'warn':
			return 'text-amber-400'
		case 'debug':
			return 'text-muted'
		default:
			return 'text-text'
	}
}
</script>

<svelte:head>
	<title>BLE Debug – Kilter Board</title>
</svelte:head>

<div class="mx-auto max-w-lg px-4 py-6">
	<!-- Header -->
	<div class="mb-6 flex items-center justify-between">
		<a
			href={resolve('/')}
			class="inline-flex items-center gap-1.5 text-sm text-muted hover:text-text"
		>
			<svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
				<path d="M19 12H5M12 5l-7 7 7 7" />
			</svg>
			Back
		</a>
		<h1 class="text-lg font-bold text-text">BLE Debug</h1>
		<div class="w-12"></div>
	</div>

	<!-- Connection status -->
	<section class="mb-6 rounded-xl border border-border bg-surface p-4">
		<div class="flex items-center justify-between">
			<div class="flex items-center gap-3">
				<span
					class="size-3 rounded-full {connector.status === 'connected'
						? 'bg-green-500'
						: connector.status === 'connecting'
							? 'animate-pulse bg-amber-500'
							: connector.status === 'error'
								? 'bg-red-500'
								: 'bg-zinc-500'}"
				></span>
				<div>
					<p class="text-sm font-medium text-text">
						{connector.status === 'connected'
							? (connector.deviceName ?? 'Connected')
							: connector.status === 'connecting'
								? 'Connecting...'
								: connector.status === 'error'
									? 'Error'
									: 'Disconnected'}
					</p>
					{#if connector.error}
						<p class="text-xs text-red-400">{connector.error}</p>
					{/if}
				</div>
			</div>
			<div class="flex gap-2">
				{#if connector.status === 'connected'}
					<button
						onclick={() => connector.disconnect()}
						class="rounded-lg border border-border bg-surface-raised px-3 py-1.5 text-sm font-medium text-text transition active:scale-95"
					>
						Disconnect
					</button>
				{:else}
					<button
						onclick={() => connector.connect()}
						disabled={connector.status === 'connecting'}
						class="rounded-lg bg-cyan-600 px-3 py-1.5 text-sm font-medium text-white transition active:scale-95 disabled:opacity-50"
					>
						{connector.status === 'connecting' ? 'Connecting...' : 'Connect'}
					</button>
				{/if}
			</div>
		</div>

		<!-- Recent boards -->
		{#if connector.recentBoards.length > 0}
			<div class="mt-3 border-t border-border pt-3">
				<p class="mb-2 text-xs text-muted">Recent boards</p>
				<div class="flex flex-wrap gap-2">
					{#each connector.recentBoards as board (board)}
						<button
							onclick={() => connector.connect()}
							class="rounded-md bg-surface-raised px-2 py-1 text-xs text-muted hover:text-text"
						>
							{board}
						</button>
					{/each}
				</div>
			</div>
		{/if}

		{#if !connector.isSupported}
			<p class="mt-3 text-xs text-red-400">
				Web Bluetooth is not supported in this browser. Use Chrome on Android or desktop.
			</p>
		{/if}
	</section>

	<!-- Test patterns -->
	<section class="mb-6 rounded-xl border border-border bg-surface p-4">
		<h2 class="mb-3 text-sm font-semibold text-text">Test Patterns</h2>

		<div class="mb-3 space-y-2">
			{#each Object.entries(patternPresets) as [key, { label }] (key)}
				<button
					onclick={() => (selectedPattern = key as Exclude<TestPattern, 'custom'>)}
					disabled={!connector.isConnected || sending}
					class="w-full rounded-lg border px-3 py-2 text-sm transition active:scale-95 disabled:opacity-50
						{selectedPattern === key
						? 'border-cyan-600 bg-cyan-600/10 text-cyan-400'
						: 'border-border bg-surface-raised text-muted hover:text-text'}"
				>
					{label}
				</button>
			{/each}
			<button
				onclick={() => (selectedPattern = 'custom')}
				disabled={!connector.isConnected || sending}
				class="w-full rounded-lg border px-3 py-2 text-sm transition active:scale-95 disabled:opacity-50
					{selectedPattern === 'custom'
					? 'border-cyan-600 bg-cyan-600/10 text-cyan-400'
					: 'border-border bg-surface-raised text-muted hover:text-text'}"
			>
				Custom frames
			</button>
		</div>

		{#if selectedPattern === 'custom'}
			<input
				type="text"
				bind:value={customFrames}
				placeholder="p1r12p2r13p3r14..."
				disabled={!connector.isConnected || sending}
				class="mb-3 w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm text-text placeholder:text-muted disabled:opacity-50"
			/>
		{/if}

		<div class="flex gap-2">
			<button
				onclick={sendTestPattern}
				disabled={!connector.isConnected || sending}
				class="flex-1 rounded-lg bg-cyan-600 px-3 py-2 text-sm font-medium text-white transition active:scale-95 disabled:opacity-50"
			>
				{sending ? 'Sending...' : 'Send Pattern'}
			</button>
			<button
				onclick={sendClear}
				disabled={!connector.isConnected || sending}
				class="rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm text-muted transition active:scale-95 disabled:opacity-50"
			>
				Clear
			</button>
		</div>
	</section>

	<!-- Log -->
	<section class="rounded-xl border border-border bg-surface p-4">
		<div class="mb-3 flex items-center justify-between">
			<h2 class="text-sm font-semibold text-text">Connection Log</h2>
			<button onclick={() => connector.clearLog()} class="text-xs text-muted hover:text-text">
				Clear
			</button>
		</div>

		<div class="max-h-80 overflow-y-auto rounded-lg border border-border bg-bg font-mono text-xs">
			{#if connector.logEntries.length === 0}
				<p class="p-3 text-muted">No log entries yet. Connect to a board to see activity.</p>
			{:else}
				{#each connector.logEntries as entry (entry.id)}
					<div class="border-b border-border px-3 py-1.5 last:border-b-0">
						<span class="text-muted">[{formatTime(entry.ts)}]</span>
						<span class="ml-1 {getLevelClass(entry.level)}">{entry.message}</span>
					</div>
				{/each}
			{/if}
		</div>
	</section>
</div>
