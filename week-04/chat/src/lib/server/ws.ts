import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'http';
import type { IncomingMessage } from 'http';
import type { ClientPayload, ServerPayload } from '$lib/types';
import { getSession, addMessage, getRoom, updateLastSeen, renameSession } from './db';

interface UserInfo {
	sessionId: string;
	nickname: string;
	color: string;
}

const clients = new Map<WebSocket, UserInfo>();
const rooms = new Map<number, Set<WebSocket>>();
const typingTimers = new Map<string, NodeJS.Timeout>();
// Grace period: sessionId -> { timer, roomIds[] } — delays "left" on disconnect
const gracePeriods = new Map<string, { timer: NodeJS.Timeout; roomIds: number[]; ws: WebSocket }>();

const GRACE_PERIOD_MS = 60_000; // 60 seconds

function parseCookie(cookieHeader: string | undefined): Record<string, string> {
	if (!cookieHeader) return {};
	const cookies: Record<string, string> = {};
	for (const pair of cookieHeader.split(';')) {
		const [name, ...rest] = pair.trim().split('=');
		if (name) cookies[name] = decodeURIComponent(rest.join('='));
	}
	return cookies;
}

function broadcast(roomId: number, payload: ServerPayload, exclude?: WebSocket) {
	const roomClients = rooms.get(roomId);
	if (!roomClients) return;
	const data = JSON.stringify(payload);
	for (const ws of roomClients) {
		if (ws !== exclude && ws.readyState === WebSocket.OPEN) {
			ws.send(data);
		}
	}
}

function broadcastAll(payload: ServerPayload) {
	const data = JSON.stringify(payload);
	for (const [ws] of clients) {
		if (ws.readyState === WebSocket.OPEN) {
			ws.send(data);
		}
	}
}

function broadcastPresence(roomId: number) {
	const roomClients = rooms.get(roomId);
	if (!roomClients) return;
	const users = Array.from(roomClients)
		.map((ws) => clients.get(ws))
		.filter((u): u is UserInfo => !!u)
		.map((u) => ({ nickname: u.nickname, color: u.color }));
	// Dedupe by nickname (same user with multiple tabs)
	const seen = new Set<string>();
	const unique = users.filter((u) => {
		if (seen.has(u.nickname)) return false;
		seen.add(u.nickname);
		return true;
	});
	broadcast(roomId, { type: 'presence', roomId, users: unique });
}

function joinRoom(ws: WebSocket, roomId: number) {
	if (!rooms.has(roomId)) {
		rooms.set(roomId, new Set());
	}
	const roomSet = rooms.get(roomId)!;
	if (roomSet.has(ws)) return;

	roomSet.add(ws);
	const user = clients.get(ws);
	if (user) {
		// Check if this user has other connections already in the room
		const otherInRoom = Array.from(roomSet).some(
			(other) => other !== ws && clients.get(other)?.sessionId === user.sessionId
		);
		if (!otherInRoom) {
			const msg = addMessage(roomId, null, 'system', `${user.nickname} joined`);
			broadcast(roomId, { type: 'system', message: msg });
		}
		broadcastPresence(roomId);
	}
}

function leaveRoom(ws: WebSocket, roomId: number, silent = false) {
	const roomSet = rooms.get(roomId);
	if (!roomSet || !roomSet.has(ws)) return;

	roomSet.delete(ws);
	const user = clients.get(ws);
	if (user) {
		// Clear typing
		const key = `${roomId}:${user.nickname}`;
		const timer = typingTimers.get(key);
		if (timer) {
			clearTimeout(timer);
			typingTimers.delete(key);
			broadcast(roomId, { type: 'stop_typing', roomId, nickname: user.nickname });
		}

		if (!silent) {
			// Check if this user has other connections still in the room
			const otherInRoom = Array.from(roomSet).some(
				(other) => clients.get(other)?.sessionId === user.sessionId
			);
			if (!otherInRoom) {
				const msg = addMessage(roomId, null, 'system', `${user.nickname} left`);
				broadcast(roomId, { type: 'system', message: msg });
			}
		}
		broadcastPresence(roomId);
	}

	if (roomSet.size === 0) {
		rooms.delete(roomId);
	}
}

/** Silently remove ws from all rooms without broadcasting "left" — used for grace period */
function silentRemoveFromRooms(ws: WebSocket): number[] {
	const roomIds: number[] = [];
	for (const [roomId, roomSet] of rooms) {
		if (roomSet.has(ws)) {
			roomIds.push(roomId);
			leaveRoom(ws, roomId, true); // silent
		}
	}
	return roomIds;
}

/** Execute the actual departure for a grace-period expiry */
function executeGraceDeparture(sessionId: string, nickname: string, roomIds: number[]) {
	// Check if the user reconnected (has an active connection)
	for (const [, info] of clients) {
		if (info.sessionId === sessionId) return; // still connected, abort
	}

	// User truly gone — broadcast "left" and update presence
	for (const roomId of roomIds) {
		const msg = addMessage(roomId, null, 'system', `${nickname} left`);
		broadcast(roomId, { type: 'system', message: msg });
		broadcastPresence(roomId);
	}
}

function handleMessage(ws: WebSocket, payload: ClientPayload) {
	const user = clients.get(ws);
	if (!user) return;

	switch (payload.type) {
		case 'join_room': {
			const room = getRoom(payload.roomId);
			if (room) joinRoom(ws, payload.roomId);
			break;
		}
		case 'leave_room': {
			leaveRoom(ws, payload.roomId);
			break;
		}
		case 'chat': {
			const content = payload.content.trim();
			if (!content || content.length > 2000) return;
			const room = getRoom(payload.roomId);
			if (!room) return;
			const roomSet = rooms.get(payload.roomId);
			if (!roomSet || !roomSet.has(ws)) return;

			const msg = addMessage(payload.roomId, user.sessionId, 'chat', content);
			const roomClients = rooms.get(payload.roomId);
			if (roomClients) {
				const data = JSON.stringify({ type: 'chat', message: msg } as ServerPayload);
				for (const client of roomClients) {
					if (client.readyState === WebSocket.OPEN) {
						client.send(data);
					}
				}
			}

			// Clear typing
			const key = `${payload.roomId}:${user.nickname}`;
			const timer = typingTimers.get(key);
			if (timer) {
				clearTimeout(timer);
				typingTimers.delete(key);
				broadcast(payload.roomId, { type: 'stop_typing', roomId: payload.roomId, nickname: user.nickname }, ws);
			}
			break;
		}
		case 'typing': {
			const key = `${payload.roomId}:${user.nickname}`;
			const existing = typingTimers.get(key);
			if (existing) clearTimeout(existing);
			broadcast(payload.roomId, { type: 'typing', roomId: payload.roomId, nickname: user.nickname }, ws);
			typingTimers.set(
				key,
				setTimeout(() => {
					typingTimers.delete(key);
					broadcast(payload.roomId, { type: 'stop_typing', roomId: payload.roomId, nickname: user.nickname }, ws);
				}, 3000)
			);
			break;
		}
		case 'stop_typing': {
			const key = `${payload.roomId}:${user.nickname}`;
			const timer = typingTimers.get(key);
			if (timer) {
				clearTimeout(timer);
				typingTimers.delete(key);
			}
			broadcast(payload.roomId, { type: 'stop_typing', roomId: payload.roomId, nickname: user.nickname }, ws);
			break;
		}
		case 'rename': {
			const newNickname = payload.nickname.trim();
			if (!newNickname || newNickname.length > 20 || !/^[\w\s\-]+$/.test(newNickname)) return;

			const oldNickname = user.nickname;
			if (oldNickname === newNickname) return;

			// Update DB
			renameSession(user.sessionId, newNickname);

			// Update all WS connections for this session
			for (const [clientWs, info] of clients) {
				if (info.sessionId === user.sessionId) {
					info.nickname = newNickname;
				}
			}

			// Broadcast system message + presence update in each room this user is in
			for (const [roomId, roomSet] of rooms) {
				if (roomSet.has(ws)) {
					const msg = addMessage(roomId, null, 'system', `${oldNickname} is now ${newNickname}`);
					broadcast(roomId, { type: 'system', message: msg });
					broadcastPresence(roomId);
				}
			}

			// Notify all clients about the rename (so sidebar user area updates)
			broadcastAll({ type: 'nickname_changed', oldNickname, newNickname, color: user.color });
			break;
		}
	}
}

// Store broadcastAll on globalThis so the SSR module context (API routes)
// can reach the same function that the Vite plugin context created.
declare global {
	var __wsBroadcastAll: ((payload: ServerPayload) => void) | undefined;
}

export function attachWs(server: Server) {
	const wss = new WebSocketServer({ noServer: true });
	globalThis.__wsBroadcastAll = broadcastAll;

	server.on('upgrade', (request: IncomingMessage, socket, head) => {
		if (request.url !== '/ws') return;

		const cookies = parseCookie(request.headers.cookie);
		const sessionId = cookies['session'];
		if (!sessionId) {
			socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
			socket.destroy();
			return;
		}

		const session = getSession(sessionId);
		if (!session) {
			socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
			socket.destroy();
			return;
		}

		wss.handleUpgrade(request, socket, head, (ws) => {
			wss.emit('connection', ws, request, session);
		});
	});

	wss.on('connection', (ws: WebSocket, _request: IncomingMessage, session: { id: string; nickname: string; color: string }) => {
		// Cancel any pending grace period for this session
		const pending = gracePeriods.get(session.id);
		if (pending) {
			clearTimeout(pending.timer);
			gracePeriods.delete(session.id);
		}

		clients.set(ws, {
			sessionId: session.id,
			nickname: session.nickname,
			color: session.color
		});

		updateLastSeen(session.id);

		ws.on('message', (data) => {
			try {
				const payload = JSON.parse(data.toString()) as ClientPayload;
				handleMessage(ws, payload);
			} catch {
				// Ignore malformed messages
			}
		});

		ws.on('close', () => {
			const user = clients.get(ws);
			if (!user) {
				clients.delete(ws);
				return;
			}

			// Collect which rooms this connection was in
			const userRoomIds = silentRemoveFromRooms(ws);
			clients.delete(ws);

			// Check if user has other active connections
			let hasOtherConnection = false;
			for (const [, info] of clients) {
				if (info.sessionId === user.sessionId) {
					hasOtherConnection = true;
					break;
				}
			}

			if (hasOtherConnection) {
				// Other tabs still open — just update presence (already done in silentRemove)
				return;
			}

			// No other connections — start grace period
			const timer = setTimeout(() => {
				gracePeriods.delete(user.sessionId);
				executeGraceDeparture(user.sessionId, user.nickname, userRoomIds);
			}, GRACE_PERIOD_MS);

			gracePeriods.set(user.sessionId, { timer, roomIds: userRoomIds, ws });
		});
	});

	return wss;
}

// Export for room creation broadcast — uses globalThis to reach the
// broadcast function from the Vite plugin's module instance.
export function broadcastNewRoom(room: import('$lib/types').Room) {
	const fn = globalThis.__wsBroadcastAll ?? broadcastAll;
	fn({ type: 'room_created', room });
}

export function broadcastRoomUpdated(room: import('$lib/types').Room) {
	const fn = globalThis.__wsBroadcastAll ?? broadcastAll;
	fn({ type: 'room_updated', room });
}
