import Database from 'better-sqlite3';
import type { Session, Room, Message } from '$lib/types';

const dbPath = process.env.DB_PATH || './data/chat.db';
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    nickname TEXT NOT NULL,
    color TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    last_seen TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS rooms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    created_by TEXT REFERENCES sessions(id),
    created_at TEXT DEFAULT (datetime('now'))
  );

  INSERT OR IGNORE INTO rooms (id, name, description) VALUES (1, 'Lobby', 'General discussion');

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room_id INTEGER NOT NULL REFERENCES rooms(id),
    session_id TEXT REFERENCES sessions(id),
    type TEXT NOT NULL DEFAULT 'chat',
    content TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_messages_room_time ON messages(room_id, created_at DESC);
`);

// Prepared statements
const insertSession = db.prepare(`
  INSERT INTO sessions (id, nickname, color) VALUES (?, ?, ?)
`);

const getSessionById = db.prepare(`
  SELECT * FROM sessions WHERE id = ?
`);

const touchSession = db.prepare(`
  UPDATE sessions SET last_seen = datetime('now') WHERE id = ?
`);

const getAllRooms = db.prepare(`
  SELECT * FROM rooms ORDER BY id
`);

const getRoomById = db.prepare(`
  SELECT * FROM rooms WHERE id = ?
`);

const getRoomByName = db.prepare(`
  SELECT * FROM rooms WHERE lower(name) = lower(?)
`);

const insertRoom = db.prepare(`
  INSERT INTO rooms (name, description, created_by) VALUES (?, ?, ?)
`);

const insertMessage = db.prepare(`
  INSERT INTO messages (room_id, session_id, type, content) VALUES (?, ?, ?, ?)
`);

const getRecentMessages = db.prepare(`
  SELECT m.*, s.nickname, s.color
  FROM messages m
  LEFT JOIN sessions s ON m.session_id = s.id
  WHERE m.room_id = ?
  ORDER BY m.id DESC
  LIMIT ?
`);

const getMessagesBefore = db.prepare(`
  SELECT m.*, s.nickname, s.color
  FROM messages m
  LEFT JOIN sessions s ON m.session_id = s.id
  WHERE m.room_id = ? AND m.id < ?
  ORDER BY m.id DESC
  LIMIT ?
`);

export function createSession(nickname: string): Session {
	const id = crypto.randomUUID();
	const color = '#' + Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0');
	insertSession.run(id, nickname, color);
	return getSessionById.get(id) as Session;
}

export function getSession(id: string): Session | undefined {
	return getSessionById.get(id) as Session | undefined;
}

export function updateLastSeen(id: string): void {
	touchSession.run(id);
}

const renameSessionStmt = db.prepare(`
  UPDATE sessions SET nickname = ? WHERE id = ?
`);

export function renameSession(id: string, nickname: string): Session | undefined {
	renameSessionStmt.run(nickname, id);
	return getSessionById.get(id) as Session | undefined;
}

export function getRooms(): Room[] {
	return getAllRooms.all() as Room[];
}

export function getRoom(id: number): Room | undefined {
	return getRoomById.get(id) as Room | undefined;
}

export function findRoomByName(name: string): Room | undefined {
	return getRoomByName.get(name) as Room | undefined;
}

export function createRoom(name: string, description: string | null, createdBy: string): Room {
	const result = insertRoom.run(name, description, createdBy);
	return getRoomById.get(result.lastInsertRowid) as Room;
}

const updateRoomStmt = db.prepare(`
  UPDATE rooms SET name = ?, description = ? WHERE id = ?
`);

export function updateRoom(id: number, name: string, description: string | null): Room | undefined {
	updateRoomStmt.run(name, description, id);
	return getRoomById.get(id) as Room | undefined;
}

export function addMessage(
	roomId: number,
	sessionId: string | null,
	type: 'chat' | 'system',
	content: string
): Message {
	const result = insertMessage.run(roomId, sessionId, type, content);
	const row = db.prepare(`
		SELECT m.*, s.nickname, s.color
		FROM messages m
		LEFT JOIN sessions s ON m.session_id = s.id
		WHERE m.id = ?
	`).get(result.lastInsertRowid);
	return row as Message;
}

export function getMessages(roomId: number, limit: number = 50): Message[] {
	const rows = getRecentMessages.all(roomId, limit) as Message[];
	return rows.reverse(); // oldest first
}

export function getMessagesBeforeId(roomId: number, beforeId: number, limit: number = 50): Message[] {
	const rows = getMessagesBefore.all(roomId, beforeId, limit) as Message[];
	return rows.reverse();
}
