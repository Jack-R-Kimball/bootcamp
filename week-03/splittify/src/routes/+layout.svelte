<script lang="ts">
	import './layout.css'
	let { children, data } = $props()
</script>

<div class="min-h-screen bg-gray-950 text-gray-100">
	{#if data.user}
		<header class="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
			<a href="/dashboard" class="text-xl font-bold tracking-tight text-indigo-400">Splittify</a>
			<div class="flex items-center gap-4">
				<span class="text-sm text-gray-400">{data.user.email}</span>
				<form method="POST" action="/dashboard?/logout">
					<button class="text-sm text-gray-400 hover:text-white transition-colors">Sign out</button>
				</form>
			</div>
		</header>
	{/if}
	<main class="mx-auto max-w-4xl px-6 py-8">
		{@render children()}
	</main>
</div>
