<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import type { Room } from '$lib/types';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';

	let { data, children } = $props();
	let wsRooms = $state<Room[]>([]);
	let newRoomName = $state('');
	let showNewRoom = $state(false);
	let creating = $state(false);

	// Nickname rename state
	let renamingNickname = $state(false);
	let newNickname = $state('');
	let nicknameOverride = $state<{ nickname: string; color: string } | null>(null);
	let displayUser = $derived(nicknameOverride ?? data.user);

	let currentSlug = $derived($page.params.room ?? '');

	// Rooms updated via WS — override server data by id
	let updatedRooms = $state<Map<number, Room>>(new Map());

	// Merge: start from server rooms, apply updates, then add WS-only rooms
	let allRooms = $derived(() => {
		const merged = data.rooms.map((r) => updatedRooms.get(r.id) ?? r);
		for (const r of wsRooms) {
			if (!merged.find((m) => m.id === r.id)) {
				merged.push(updatedRooms.get(r.id) ?? r);
			}
		}
		return merged;
	});

	function handleRoomCreated(e: Event) {
		const room = (e as CustomEvent).detail as Room;
		if (!wsRooms.find((r) => r.id === room.id)) {
			wsRooms = [...wsRooms, room];
		}
	}

	function handleRoomUpdated(e: Event) {
		const room = (e as CustomEvent).detail as Room;
		updatedRooms.set(room.id, room);
		updatedRooms = new Map(updatedRooms);
	}

	function handleNicknameChanged(e: Event) {
		const detail = (e as CustomEvent).detail as { newNickname: string; color: string };
		nicknameOverride = { nickname: detail.newNickname, color: detail.color };
		renamingNickname = false;
	}

	onMount(() => {
		window.addEventListener('room_created', handleRoomCreated);
		window.addEventListener('room_updated', handleRoomUpdated);
		window.addEventListener('nickname_changed_self', handleNicknameChanged);
	});

	onDestroy(() => {
		if (typeof window !== 'undefined') {
			window.removeEventListener('room_created', handleRoomCreated);
			window.removeEventListener('room_updated', handleRoomUpdated);
			window.removeEventListener('nickname_changed_self', handleNicknameChanged);
		}
	});

	async function createRoom() {
		const name = newRoomName.trim();
		if (!name || creating) return;

		creating = true;
		try {
			const res = await fetch('/api/rooms', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name })
			});

			if (res.ok) {
				const room: Room = await res.json();
				newRoomName = '';
				showNewRoom = false;
				if (!wsRooms.find((r) => r.id === room.id)) {
					wsRooms = [...wsRooms, room];
				}
				goto(`/chat/${encodeURIComponent(room.name.toLowerCase())}`);
			} else {
				const err = await res.json();
				alert(err.error || 'Failed to create room');
			}
		} finally {
			creating = false;
		}
	}

	function signOut() {
		document.cookie = 'session=; path=/; max-age=0';
		goto('/');
	}
</script>

<svelte:head>
	<title>Chat</title>
</svelte:head>

<div class="flex h-dvh">
	<!-- Sidebar: hidden on mobile when in a room -->
	<aside
		class="flex w-full flex-col border-r border-zinc-800 bg-zinc-950 md:w-64 md:flex-shrink-0
		{currentSlug ? 'hidden md:flex' : 'flex'}"
	>
		<div class="flex items-center justify-between border-b border-zinc-800 p-4">
			<h2 class="text-lg font-bold">Rooms</h2>
			<button
				onclick={() => (showNewRoom = !showNewRoom)}
				class="rounded-lg bg-zinc-800 px-3 py-1.5 text-sm text-zinc-300 transition-colors hover:bg-zinc-700"
				title="New room"
			>
				+
			</button>
		</div>

		{#if showNewRoom}
			<form
				onsubmit={(e) => { e.preventDefault(); createRoom(); }}
				class="border-b border-zinc-800 p-3"
			>
				<input
					type="text"
					bind:value={newRoomName}
					placeholder="Room name..."
					maxlength="30"
					class="mb-2 w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:border-blue-500 focus:outline-none"
				/>
				<div class="flex gap-2">
					<button
						type="submit"
						disabled={!newRoomName.trim() || creating}
						class="flex-1 rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
					>
						Create
					</button>
					<button
						type="button"
						onclick={() => { showNewRoom = false; newRoomName = ''; }}
						class="rounded px-3 py-1.5 text-sm text-zinc-400 hover:text-zinc-200"
					>
						Cancel
					</button>
				</div>
			</form>
		{/if}

		<nav class="flex-1 overflow-y-auto p-2">
			{#each allRooms() as room}
				<a
					href="/chat/{encodeURIComponent(room.name.toLowerCase())}"
					class="block rounded-lg px-3 py-2.5 text-sm transition-colors
					{currentSlug === room.name.toLowerCase() ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'}"
				>
					<span class="font-medium"># {room.name}</span>
					{#if room.description}
						<span class="mt-0.5 block text-xs text-zinc-500">{room.description}</span>
					{/if}
				</a>
			{/each}
		</nav>

		<div class="border-t border-zinc-800 p-3">
			{#if renamingNickname}
				<form onsubmit={(e) => { e.preventDefault(); if (newNickname.trim()) { window.dispatchEvent(new CustomEvent('rename_request', { detail: newNickname.trim() })); } }} class="flex gap-2">
					<input
						type="text"
						bind:value={newNickname}
						maxlength="20"
						placeholder="New nickname..."
						class="min-w-0 flex-1 rounded border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-sm text-zinc-100 placeholder-zinc-500 focus:border-blue-500 focus:outline-none"
					/>
					<button
						type="submit"
						disabled={!newNickname.trim()}
						class="rounded bg-blue-600 px-2 py-1.5 text-xs font-medium text-white hover:bg-blue-500 disabled:opacity-50"
					>
						OK
					</button>
					<button
						type="button"
						onclick={() => renamingNickname = false}
						class="text-xs text-zinc-500 hover:text-zinc-300"
					>
						X
					</button>
				</form>
			{:else}
				<div class="flex items-center justify-between">
					<button
						onclick={() => { newNickname = displayUser?.nickname ?? ''; renamingNickname = true; }}
						class="flex items-center gap-2 rounded px-1 py-0.5 transition-colors hover:bg-zinc-800"
						title="Click to rename"
					>
						<div
							class="flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold text-white"
							style="background-color: {displayUser?.color}"
						>
							{displayUser?.nickname?.charAt(0).toUpperCase()}
						</div>
						<span class="text-sm font-medium">{displayUser?.nickname}</span>
					</button>
					<button
						onclick={signOut}
						class="text-xs text-zinc-500 hover:text-zinc-300"
					>
						Sign out
					</button>
				</div>
			{/if}
		</div>
	</aside>

	<!-- Main content -->
	<main class="flex flex-1 flex-col {currentSlug ? 'flex' : 'hidden md:flex'}">
		{#if !currentSlug}
			<div class="flex flex-1 items-center justify-center text-zinc-500">
				Select a room to start chatting
			</div>
		{:else}
			{@render children()}
		{/if}
	</main>
</div>
