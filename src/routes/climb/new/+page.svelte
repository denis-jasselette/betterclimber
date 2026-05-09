<script lang="ts">
	import { goto } from '$app/navigation'
	import ClimbForm from '$lib/components/ClimbForm.svelte'
	import TopBar from '$lib/components/TopBar.svelte'
	import { saveCustomClimb } from '$lib/data/custom-climbs'

	async function handleSave(payload: {
		name: string
		description: string
		angle: number | null
		difficulty: number | null
		allowMatches: boolean
		isCampus: boolean
		isDraft: boolean
		frames: string
	}) {
		const uuid = crypto.randomUUID()
		saveCustomClimb({
			uuid,
			...payload,
			createdAt: new Date().toISOString()
		})
		const dest = payload.angle !== null ? `/climb/${uuid}?angle=${payload.angle}` : `/climb/${uuid}`
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

	<ClimbForm title="Create custom climb" cancelHref="/" onSave={handleSave} />
</div>
