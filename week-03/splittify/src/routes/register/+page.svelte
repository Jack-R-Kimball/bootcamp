<script lang="ts">
	import type { ActionData } from './$types'
	let { form }: { form: ActionData } = $props()
</script>

<div class="mx-auto max-w-sm">
	<h1 class="text-2xl font-bold mb-6">Create an account</h1>

	{#if form?.error}
		<p class="mb-4 rounded-lg bg-red-900/50 border border-red-700 px-4 py-3 text-sm text-red-300">
			{form.error}
		</p>
	{/if}

	<form method="POST" class="space-y-4">
		<div>
			<label for="email" class="block text-sm font-medium text-gray-400 mb-1">Email</label>
			<input
				id="email"
				name="email"
				type="email"
				required
				value={form?.email ?? ''}
				class="w-full rounded-lg border border-gray-700 bg-gray-900 px-4 py-2 text-sm focus:border-indigo-500 focus:outline-none"
			/>
		</div>
		<div>
			<label for="password" class="block text-sm font-medium text-gray-400 mb-1">Password</label>
			<input
				id="password"
				name="password"
				type="password"
				required
				minlength="6"
				class="w-full rounded-lg border border-gray-700 bg-gray-900 px-4 py-2 text-sm focus:border-indigo-500 focus:outline-none"
			/>
		</div>
		<button
			type="submit"
			class="w-full rounded-lg bg-indigo-600 py-2 font-semibold hover:bg-indigo-500 transition-colors"
		>
			Create account
		</button>
	</form>

	<p class="mt-4 text-center text-sm text-gray-500">
		Already have an account? <a href="/login" class="text-indigo-400 hover:underline">Sign in</a>
	</p>
</div>
