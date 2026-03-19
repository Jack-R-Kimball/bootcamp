import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getRooms, createRoom, findRoomByName, getRoom, updateRoom } from '$lib/server/db';
import { broadcastNewRoom, broadcastRoomUpdated } from '$lib/server/ws';

export const GET: RequestHandler = async () => {
	return json(getRooms());
};

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.session) {
		throw error(401, 'Not authenticated');
	}

	const body = await request.json();
	const name = (body.name as string)?.trim();

	if (!name || name.length < 1 || name.length > 30) {
		throw error(400, 'Room name must be 1-30 characters');
	}

	if (!/^[\w\s\-]+$/.test(name)) {
		throw error(400, 'Room name can only contain letters, numbers, spaces, hyphens, and underscores');
	}

	if (findRoomByName(name)) {
		throw error(409, 'A room with that name already exists');
	}

	const room = createRoom(name, null, locals.session.id);
	broadcastNewRoom(room);

	return json(room, { status: 201 });
};

export const PATCH: RequestHandler = async ({ request, locals }) => {
	if (!locals.session) {
		throw error(401, 'Not authenticated');
	}

	const body = await request.json();
	const id = body.id as number;
	const name = (body.name as string)?.trim();
	const description = ((body.description as string) ?? '').trim() || null;

	if (!id || !name) {
		throw error(400, 'Room ID and name are required');
	}

	if (name.length < 1 || name.length > 30) {
		throw error(400, 'Room name must be 1-30 characters');
	}

	if (!/^[\w\s\-]+$/.test(name)) {
		throw error(400, 'Room name can only contain letters, numbers, spaces, hyphens, and underscores');
	}

	const existing = getRoom(id);
	if (!existing) {
		throw error(404, 'Room not found');
	}

	// Check for name collision with a different room
	const nameMatch = findRoomByName(name);
	if (nameMatch && nameMatch.id !== id) {
		throw error(409, 'A room with that name already exists');
	}

	const room = updateRoom(id, name, description);
	if (room) {
		broadcastRoomUpdated(room);
	}

	return json(room);
};
