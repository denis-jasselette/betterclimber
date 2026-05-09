<script lang="ts">
	let {
		onconfirm,
		onskip
	}: {
		onconfirm: () => void
		onskip: () => void
	} = $props()

	let importing = $state(false)
	let error = $state<string | null>(null)

	async function handleImport() {
		importing = true
		error = null
		try {
			const res = await fetch('/api/log/import', { method: 'POST' })
			if (!res.ok) {
				error = 'Import failed. Please try again.'
				return
			}
			onconfirm()
		} catch {
			error = 'Import failed. Please try again.'
		} finally {
			importing = false
		}
	}
</script>

<div class="mt-3 rounded-xl border border-cyan-600/40 bg-cyan-600/5 px-4 py-3">
	<p class="mb-1 text-sm font-semibold text-text">Import your data?</p>
	<p class="mb-3 text-xs text-muted">
		You have ticks and likes saved on this device. Would you like to import them into your account so
		they sync across devices?
	</p>
	{#if error}
		<p class="mb-2 text-xs text-red-400">{error}</p>
	{/if}
	<div class="flex gap-2">
		<button
			onclick={handleImport}
			disabled={importing}
			class="rounded-lg bg-cyan-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-cyan-500 disabled:opacity-50"
		>
			{importing ? 'Importing…' : 'Import'}
		</button>
		<button
			onclick={onskip}
			disabled={importing}
			class="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted transition hover:text-text disabled:opacity-50"
		>
			Skip
		</button>
	</div>
</div>
