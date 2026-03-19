<script>
	import './layout.css';
	let { children } = $props();
</script>

<div class="min-h-dvh bg-zinc-900 text-zinc-100">
	{@render children()}
</div>
