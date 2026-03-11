<script lang="ts">
	import type { PageData, ActionData } from './$types'
	let { data, form }: { data: PageData; form: ActionData } = $props()
</script>

<div class="flex items-center justify-between mb-8">
	<h1 class="text-2xl font-bold">Your Groups</h1>
</div>

{#if form?.error}
	<p class="mb-4 rounded-lg bg-red-900/50 border border-red-700 px-4 py-3 text-sm text-red-300">
		{form.error}
	</p>
{/if}

<!-- Create group form -->
<form method="POST" action="?/createGroup" class="mb-8 flex gap-3">
	<input
		name="name"
		type="text"
		placeholder="New group name..."
		required
		class="flex-1 rounded-lg border border-gray-700 bg-gray-900 px-4 py-2 text-sm focus:border-indigo-500 focus:outline-none"
	/>
	<button
		type="submit"
		class="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold hover:bg-indigo-500 transition-colors"
	>
		Create group
	</button>
</form>

<!-- Group list -->
{#if data.groups.length === 0}
	<p class="text-center text-gray-500 py-16">No groups yet. Create one above.</p>
{:else}
	<div class="space-y-3">
		{#each data.groups as group}
			<a
				href="/groups/{group.id}"
				class="block rounded-lg border border-gray-800 bg-gray-900 px-5 py-4 hover:border-indigo-700 transition-colors"
			>
				<p class="font-semibold">{group.name}</p>
				<p class="text-sm text-gray-500 mt-0.5">
					Created {new Date(group.created_at).toLocaleDateString()}
				</p>
			</a>
		{/each}
	</div>
{/if}
