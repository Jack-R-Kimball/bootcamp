<script lang="ts">
	import { onMount, onDestroy, tick } from 'svelte';
	import { goto } from '$app/navigation';
	import type { Message, Room, ServerPayload, ClientPayload } from '$lib/types';

	let { data } = $props();

	// Derived values that update when data changes (e.g. room navigation)
	let roomOverride = $state<Room | null>(null);
	let currentRoom = $derived(roomOverride?.id === data.room.id ? roomOverride : data.room);
	let currentRoomId = $derived(data.room.id);

	// Room edit state
	let editing = $state(false);
	let editName = $state('');
	let editDescription = $state('');
	let saving = $state(false);

	let messages = $state<Message[]>([]);
	let input = $state('');
	let messagesContainer: HTMLDivElement;
	let inputEl: HTMLInputElement;
	let ws: WebSocket | null = null;
	let connected = $state(false);
	let onlineUsers = $state<{ nickname: string; color: string }[]>([]);

	// @mention autocomplete state
	let showMentions = $state(false);
	let mentionQuery = $state('');
	let mentionIndex = $state(0);
	let mentionStartPos = $state(0);
	let filteredMentions = $derived(
		mentionQuery
			? onlineUsers.filter((u) =>
					u.nickname.toLowerCase().startsWith(mentionQuery.toLowerCase())
				)
			: onlineUsers
	);
	let typingUsers = $state<string[]>([]);
	let isAtBottom = $state(true);
	let loadingHistory = $state(false);
	let hasMoreHistory = $state(false);
	let reconnectDelay = 1000;
	let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
	let lastTypingSent = 0;
	let prevRoomId = -1;

	// Reset state when room changes (including initial load)
	$effect(() => {
		const newMessages = data.messages;
		const newRoomId = data.room.id;
		messages = newMessages;
		onlineUsers = [];
		typingUsers = [];
		hasMoreHistory = newMessages.length >= 50;

		// Handle room transitions
		if (prevRoomId !== -1 && prevRoomId !== newRoomId) {
			send({ type: 'leave_room', roomId: prevRoomId });
			send({ type: 'join_room', roomId: newRoomId });
		}
		prevRoomId = newRoomId;

		tick().then(() => {
			scrollToBottom();
			inputEl?.focus();
		});
	});

	function scrollToBottom() {
		if (messagesContainer) {
			messagesContainer.scrollTop = messagesContainer.scrollHeight;
			isAtBottom = true;
		}
	}

	function handleScroll() {
		if (!messagesContainer) return;
		const { scrollTop, scrollHeight, clientHeight } = messagesContainer;
		isAtBottom = scrollHeight - scrollTop - clientHeight < 50;

		if (scrollTop < 100 && hasMoreHistory && !loadingHistory && messages.length > 0) {
			loadHistory();
		}
	}

	async function loadHistory() {
		if (loadingHistory || !hasMoreHistory || messages.length === 0) return;
		loadingHistory = true;

		const oldestId = messages[0].id;
		const roomId = currentRoomId;
		const oldScrollHeight = messagesContainer.scrollHeight;

		try {
			const res = await fetch(`/api/messages/${roomId}?before=${oldestId}&limit=50`);
			if (res.ok) {
				const older: Message[] = await res.json();
				if (older.length < 50) hasMoreHistory = false;
				if (older.length > 0) {
					messages = [...older, ...messages];
					await tick();
					messagesContainer.scrollTop = messagesContainer.scrollHeight - oldScrollHeight;
				}
			}
		} finally {
			loadingHistory = false;
		}
	}

	function connectWs() {
		const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
		ws = new WebSocket(`${protocol}//${location.host}/ws`);

		ws.onopen = () => {
			connected = true;
			reconnectDelay = 1000;
			send({ type: 'join_room', roomId: currentRoomId });
		};

		ws.onmessage = (event) => {
			const payload = JSON.parse(event.data) as ServerPayload;
			const roomId = currentRoomId;

			switch (payload.type) {
				case 'chat':
				case 'system':
					if (payload.message.room_id === roomId) {
						messages = [...messages, payload.message];
						if (isAtBottom) {
							tick().then(scrollToBottom);
						}
					}
					break;
				case 'presence':
					if (payload.roomId === roomId) {
						onlineUsers = payload.users;
					}
					break;
				case 'typing':
					if (payload.roomId === roomId && !typingUsers.includes(payload.nickname)) {
						typingUsers = [...typingUsers, payload.nickname];
					}
					break;
				case 'stop_typing':
					if (payload.roomId === roomId) {
						typingUsers = typingUsers.filter((n) => n !== payload.nickname);
					}
					break;
				case 'room_created':
					window.dispatchEvent(new CustomEvent('room_created', { detail: payload.room }));
					break;
				case 'room_updated':
					window.dispatchEvent(new CustomEvent('room_updated', { detail: payload.room }));
					if (payload.room.id === currentRoomId) {
						roomOverride = payload.room;
						const newSlug = encodeURIComponent(payload.room.name.toLowerCase());
						goto(`/chat/${newSlug}`, { replaceState: true, noScroll: true });
					}
					break;
				case 'nickname_changed':
					// If it's us, notify the layout
					if (payload.oldNickname === data.user?.nickname || payload.newNickname === data.user?.nickname) {
						window.dispatchEvent(new CustomEvent('nickname_changed_self', { detail: payload }));
					}
					break;
			}
		};

		ws.onclose = () => {
			connected = false;
			reconnectTimer = setTimeout(() => {
				reconnectDelay = Math.min(reconnectDelay * 2, 30000);
				connectWs();
			}, reconnectDelay);
		};

		ws.onerror = () => {
			ws?.close();
		};
	}

	function send(payload: ClientPayload) {
		if (ws && ws.readyState === WebSocket.OPEN) {
			ws.send(JSON.stringify(payload));
		}
	}

	function sendMessage() {
		const content = input.trim();
		if (!content) return;
		const roomId = currentRoomId;
		send({ type: 'chat', roomId, content });
		input = '';
		send({ type: 'stop_typing', roomId });
	}

	function handleKeydown(e: KeyboardEvent) {
		if (showMentions && filteredMentions.length > 0) {
			if (e.key === 'ArrowDown') {
				e.preventDefault();
				mentionIndex = (mentionIndex + 1) % filteredMentions.length;
				return;
			}
			if (e.key === 'ArrowUp') {
				e.preventDefault();
				mentionIndex = (mentionIndex - 1 + filteredMentions.length) % filteredMentions.length;
				return;
			}
			if (e.key === 'Enter' || e.key === 'Tab') {
				e.preventDefault();
				insertMention(filteredMentions[mentionIndex].nickname);
				return;
			}
			if (e.key === 'Escape') {
				e.preventDefault();
				showMentions = false;
				return;
			}
		}

		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault();
			sendMessage();
		}
	}

	function handleInput() {
		const now = Date.now();
		if (now - lastTypingSent > 2000) {
			send({ type: 'typing', roomId: currentRoomId });
			lastTypingSent = now;
		}

		// Check for @mention trigger
		checkMentionTrigger();
	}

	function checkMentionTrigger() {
		if (!inputEl) return;
		const pos = inputEl.selectionStart ?? 0;
		const text = input.slice(0, pos);
		const atIndex = text.lastIndexOf('@');

		if (atIndex === -1 || (atIndex > 0 && text[atIndex - 1] !== ' ')) {
			showMentions = false;
			return;
		}

		const query = text.slice(atIndex + 1);
		// Close if there's a space after the query (completed mention)
		if (query.includes(' ')) {
			showMentions = false;
			return;
		}

		mentionQuery = query;
		mentionStartPos = atIndex;
		mentionIndex = 0;
		showMentions = true;
	}

	function insertMention(nickname: string) {
		const before = input.slice(0, mentionStartPos);
		const after = input.slice((inputEl?.selectionStart ?? mentionStartPos) || mentionStartPos);
		input = `${before}@${nickname} ${after}`;
		showMentions = false;
		tick().then(() => {
			const newPos = mentionStartPos + nickname.length + 2; // @name + space
			inputEl?.setSelectionRange(newPos, newPos);
			inputEl?.focus();
		});
	}

	/** Split message content into text and @mention segments */
	function parseContent(text: string): { type: 'text' | 'mention'; value: string }[] {
		const parts: { type: 'text' | 'mention'; value: string }[] = [];
		const regex = /@([\w\-]+)/g;
		let lastIndex = 0;
		let match;
		while ((match = regex.exec(text)) !== null) {
			if (match.index > lastIndex) {
				parts.push({ type: 'text', value: text.slice(lastIndex, match.index) });
			}
			parts.push({ type: 'mention', value: match[1] });
			lastIndex = regex.lastIndex;
		}
		if (lastIndex < text.length) {
			parts.push({ type: 'text', value: text.slice(lastIndex) });
		}
		return parts;
	}

	function formatTime(dateStr: string): string {
		const date = new Date(dateStr + 'Z');
		return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
	}

	function startEditing() {
		editName = currentRoom.name;
		editDescription = currentRoom.description ?? '';
		editing = true;
	}

	function cancelEditing() {
		editing = false;
	}

	async function saveEdit() {
		const name = editName.trim();
		if (!name || saving) return;

		saving = true;
		try {
			const res = await fetch('/api/rooms', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					id: currentRoomId,
					name,
					description: editDescription.trim() || null
				})
			});

			if (res.ok) {
				editing = false;
				// Room update will arrive via WS broadcast
			} else {
				const err = await res.json();
				alert(err.error || 'Failed to update room');
			}
		} finally {
			saving = false;
		}
	}

	function handleRenameRequest(e: Event) {
		const nickname = (e as CustomEvent).detail as string;
		send({ type: 'rename', nickname });
	}

	onMount(() => {
		connectWs();
		scrollToBottom();
		inputEl?.focus();
		window.addEventListener('rename_request', handleRenameRequest);
	});

	onDestroy(() => {
		if (typeof window !== 'undefined') {
			window.removeEventListener('rename_request', handleRenameRequest);
		}
		if (ws) {
			send({ type: 'leave_room', roomId: currentRoomId });
			ws.close();
			ws = null;
		}
		if (reconnectTimer) clearTimeout(reconnectTimer);
	});
</script>

<div class="flex h-full flex-col">
	<!-- Header -->
	<header class="border-b border-zinc-800 px-4 py-3">
		{#if editing}
			<form onsubmit={(e) => { e.preventDefault(); saveEdit(); }} class="flex flex-col gap-2">
				<div class="flex items-center gap-2">
					<span class="text-lg font-bold text-zinc-500">#</span>
					<input
						type="text"
						bind:value={editName}
						maxlength="30"
						class="flex-1 rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-lg font-bold text-zinc-100 focus:border-blue-500 focus:outline-none"
					/>
				</div>
				<input
					type="text"
					bind:value={editDescription}
					placeholder="Room description (optional)"
					maxlength="100"
					class="rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs text-zinc-300 placeholder-zinc-500 focus:border-blue-500 focus:outline-none"
				/>
				<div class="flex gap-2">
					<button
						type="submit"
						disabled={!editName.trim() || saving}
						class="rounded bg-blue-600 px-3 py-1 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
					>
						Save
					</button>
					<button
						type="button"
						onclick={cancelEditing}
						class="rounded px-3 py-1 text-sm text-zinc-400 hover:text-zinc-200"
					>
						Cancel
					</button>
				</div>
			</form>
		{:else}
			<div class="flex items-center justify-between">
				<div class="flex items-center gap-3">
					<a href="/chat" class="text-zinc-400 hover:text-zinc-200 md:hidden">
						&larr;
					</a>
					<div class="flex items-center gap-2">
						<div>
							<h1 class="text-lg font-bold"># {currentRoom.name}</h1>
							{#if currentRoom.description}
								<p class="text-xs text-zinc-500">{currentRoom.description}</p>
							{/if}
						</div>
						<button
							onclick={startEditing}
							class="rounded p-1 text-zinc-600 transition-colors hover:bg-zinc-800 hover:text-zinc-300"
							title="Edit room"
						>
							<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
								<path d="m15 5 4 4"/>
							</svg>
						</button>
					</div>
				</div>
				<div class="flex items-center gap-2">
					{#if !connected}
						<span class="text-xs text-yellow-500">Reconnecting...</span>
					{/if}
					<div class="flex -space-x-1.5">
						{#each onlineUsers.slice(0, 5) as user}
							<div
								class="flex h-7 w-7 items-center justify-center rounded-full border-2 border-zinc-900 text-xs font-bold text-white"
								style="background-color: {user.color}"
								title={user.nickname}
							>
								{user.nickname.charAt(0).toUpperCase()}
							</div>
						{/each}
						{#if onlineUsers.length > 5}
							<div class="flex h-7 w-7 items-center justify-center rounded-full border-2 border-zinc-900 bg-zinc-700 text-xs text-zinc-300">
								+{onlineUsers.length - 5}
							</div>
						{/if}
					</div>
					{#if onlineUsers.length > 0}
						<span class="text-xs text-zinc-500">{onlineUsers.length} online</span>
					{/if}
				</div>
			</div>
		{/if}
	</header>

	<!-- Messages -->
	<div
		bind:this={messagesContainer}
		onscroll={handleScroll}
		class="flex-1 overflow-y-auto px-4 py-3"
	>
		{#if loadingHistory}
			<div class="py-2 text-center text-xs text-zinc-500">Loading older messages...</div>
		{/if}

		{#if !hasMoreHistory && messages.length > 0}
			<div class="py-2 text-center text-xs text-zinc-500">Beginning of conversation</div>
		{/if}

		<div class="space-y-1">
			{#each messages as msg, i}
				{#if msg.type === 'system'}
					<div class="py-1 text-center text-xs text-zinc-500">
						{msg.content}
						<span class="text-zinc-600">{formatTime(msg.created_at)}</span>
					</div>
				{:else}
					{@const prevMsg = messages[i - 1]}
					{@const sameAuthor = prevMsg?.type === 'chat' && prevMsg.session_id === msg.session_id}
					{@const timeDiff = prevMsg ? new Date(msg.created_at + 'Z').getTime() - new Date(prevMsg.created_at + 'Z').getTime() : Infinity}
					{@const grouped = sameAuthor && timeDiff < 60000}

					{#if !grouped}
						<div class="flex items-start gap-3 pt-2">
							<div
								class="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
								style="background-color: {msg.color}"
							>
								{msg.nickname?.charAt(0).toUpperCase()}
							</div>
							<div class="min-w-0 flex-1">
								<div class="flex items-baseline gap-2">
									<span class="font-semibold" style="color: {msg.color}">
										{msg.nickname}
									</span>
									<span class="text-xs text-zinc-500" title={msg.created_at}>
										{formatTime(msg.created_at)}
									</span>
								</div>
								<p class="break-words text-zinc-200">{#each parseContent(msg.content) as part}{#if part.type === 'mention'}<span class="rounded bg-blue-900/50 px-0.5 font-medium text-blue-300">@{part.value}</span>{:else}{part.value}{/if}{/each}</p>
							</div>
						</div>
					{:else}
						<div class="group flex items-start gap-3 pl-11">
							<p class="min-w-0 flex-1 break-words text-zinc-200">
								<span class="invisible text-xs text-zinc-600 group-hover:visible">
									{formatTime(msg.created_at)}
								</span>
								{#each parseContent(msg.content) as part}{#if part.type === 'mention'}<span class="rounded bg-blue-900/50 px-0.5 font-medium text-blue-300">@{part.value}</span>{:else}{part.value}{/if}{/each}
							</p>
						</div>
					{/if}
				{/if}
			{/each}
		</div>

		{#if messages.length === 0}
			<div class="flex h-full items-center justify-center text-zinc-500">
				No messages yet. Say something!
			</div>
		{/if}
	</div>

	<!-- Typing indicator -->
	{#if typingUsers.length > 0}
		<div class="px-4 py-1 text-xs text-zinc-500">
			{#if typingUsers.length === 1}
				<span class="font-medium">{typingUsers[0]}</span> is typing...
			{:else if typingUsers.length === 2}
				<span class="font-medium">{typingUsers[0]}</span> and
				<span class="font-medium">{typingUsers[1]}</span> are typing...
			{:else}
				Several people are typing...
			{/if}
		</div>
	{/if}

	<!-- New message indicator when scrolled up -->
	{#if !isAtBottom && messages.length > 0}
		<button
			onclick={scrollToBottom}
			class="mx-auto -mt-8 mb-2 rounded-full bg-blue-600 px-3 py-1 text-xs text-white shadow-lg"
		>
			New messages below
		</button>
	{/if}

	<!-- @Mention autocomplete -->
	{#if showMentions && filteredMentions.length > 0}
		<div class="border-t border-zinc-800 bg-zinc-850 px-3 py-1">
			<div class="flex flex-wrap gap-1">
				{#each filteredMentions as user, i}
					<button
						onmousedown={(e) => { e.preventDefault(); insertMention(user.nickname); }}
						class="flex items-center gap-1.5 rounded px-2 py-1 text-sm transition-colors
						{i === mentionIndex ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'}"
					>
						<div
							class="flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold text-white"
							style="background-color: {user.color}"
						>
							{user.nickname.charAt(0).toUpperCase()}
						</div>
						{user.nickname}
					</button>
				{/each}
			</div>
		</div>
	{/if}

	<!-- Input -->
	<div class="border-t border-zinc-800 p-3">
		<form onsubmit={(e) => { e.preventDefault(); sendMessage(); }} class="flex gap-2">
			<input
				bind:this={inputEl}
				bind:value={input}
				oninput={handleInput}
				onkeydown={handleKeydown}
				type="text"
				placeholder="Type a message... (@ to mention)"
				maxlength="2000"
				autocomplete="off"
				class="min-h-[44px] flex-1 rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-zinc-100 placeholder-zinc-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
			/>
			<button
				type="submit"
				disabled={!input.trim()}
				class="min-h-[44px] rounded-lg bg-blue-600 px-5 font-medium text-white transition-colors hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
			>
				Send
			</button>
		</form>
	</div>
</div>
