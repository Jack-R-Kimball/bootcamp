<script lang="ts">
	import { enhance } from '$app/forms';
	let { data } = $props();
	let nickname = $state('');
	let error = $state('');

	// If already logged in, redirect handled by server
</script>

<svelte:head>
	<title>Chat - Join</title>
</svelte:head>

<div class="flex min-h-dvh items-center justify-center p-4">
	<div class="w-full max-w-sm">
		<h1 class="mb-8 text-center text-3xl font-bold text-zinc-100">Chat</h1>

		<form
			method="POST"
			use:enhance={() => {
				return async ({ result, update }) => {
					if (result.type === 'failure') {
						error = (result.data as { error?: string })?.error ?? 'Something went wrong';
					} else {
						await update();
					}
				};
			}}
			class="space-y-4"
		>
			<div>
				<label for="nickname" class="mb-1 block text-sm font-medium text-zinc-400">
					Pick a nickname
				</label>
				<input
					id="nickname"
					name="nickname"
					type="text"
					bind:value={nickname}
					maxlength="20"
					autocomplete="off"
					autofocus
					required
					class="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-3 text-zinc-100 placeholder-zinc-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
					placeholder="Your name..."
				/>
			</div>

			{#if error}
				<p class="text-sm text-red-400">{error}</p>
			{/if}

			<button
				type="submit"
				disabled={!nickname.trim()}
				class="w-full rounded-lg bg-blue-600 px-4 py-3 font-medium text-white transition-colors hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
			>
				Join Chat
			</button>
		</form>
	</div>
</div>
