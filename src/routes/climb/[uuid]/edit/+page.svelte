<script lang="ts">
	import { goto } from '$app/navigation'
	import { page } from '$app/state'
	import ClimbForm from '$lib/components/ClimbForm.svelte'
	import TopBar from '$lib/components/TopBar.svelte'
	import { saveCustomClimb } from '$lib/data/custom-climbs'
	import { type Angle, difficultyToGrade } from '$lib/data/types'

	let { data } = $props()

	// svelte-ignore state_referenced_locally — intentional: edit page loads once for a fixed climb
	const existing = data.climb

	const cancelHref = $derived(`/climb/${existing.uuid}${page.url.search}`)

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
		saveCustomClimb({
			uuid: existing.uuid,
			...payload,
			createdAt: existing.createdAt
		})
		const dest =
			payload.angle !== null
				? `/climb/${existing.uuid}?angle=${payload.angle}`
				: `/climb/${existing.uuid}`
		// eslint-disable-next-line svelte/no-navigation-without-resolve
		await goto(dest)
	}
</script>

<div class="min-h-screen bg-bg">
	<TopBar>
		<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
		<a
			href={cancelHref}
			class="flex h-9 items-center gap-1.5 rounded-xl border border-border bg-surface-raised px-3 text-sm text-muted transition hover:text-text active:scale-95"
		>
			Cancel
		</a>
	</TopBar>

	<ClimbForm
		title="Edit climb"
		{cancelHref}
		initialName={existing.name}
		initialDescription={existing.description}
		initialAngle={existing.angle as Angle | null}
		initialGrade={existing.difficulty !== null ? difficultyToGrade(existing.difficulty) : null}
		initialAllowMatches={existing.allowMatches}
		initialIsCampus={existing.isCampus}
		initialIsDraft={existing.isDraft}
		initialFrames={existing.frames}
		onSave={handleSave}
	/>
</div>
