export interface Session {
	id: string;
	nickname: string;
	color: string;
	created_at: string;
	last_seen: string;
}

export interface Room {
	id: number;
	name: string;
	description: string | null;
	created_by: string | null;
	created_at: string;
}

export interface Message {
	id: number;
	room_id: number;
	session_id: string | null;
	nickname: string | null;
	color: string | null;
	type: 'chat' | 'system';
	content: string;
	created_at: string;
}

// WebSocket payloads — client to server
export type ClientPayload =
	| { type: 'join_room'; roomId: number }
	| { type: 'leave_room'; roomId: number }
	| { type: 'chat'; roomId: number; content: string }
	| { type: 'typing'; roomId: number }
	| { type: 'stop_typing'; roomId: number }
	| { type: 'rename'; nickname: string };

// WebSocket payloads — server to client
export type ServerPayload =
	| { type: 'chat'; message: Message }
	| { type: 'system'; message: Message }
	| { type: 'presence'; roomId: number; users: { nickname: string; color: string }[] }
	| { type: 'typing'; roomId: number; nickname: string }
	| { type: 'stop_typing'; roomId: number; nickname: string }
	| { type: 'room_created'; room: Room }
	| { type: 'room_updated'; room: Room }
	| { type: 'nickname_changed'; oldNickname: string; newNickname: string; color: string };
