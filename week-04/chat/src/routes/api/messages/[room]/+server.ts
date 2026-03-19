import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getMessages, getMessagesBeforeId, getRoom } from '$lib/server/db';

export const GET: RequestHandler = async ({ params, url, locals }) => {
	if (!locals.session) {
		throw error(401, 'Not authenticated');
	}

	const roomId = parseInt(params.room);
	if (isNaN(roomId)) {
		throw error(400, 'Invalid room ID');
	}

	const room = getRoom(roomId);
	if (!room) {
		throw error(404, 'Room not found');
	}

	const before = url.searchParams.get('before');
	const limit = Math.min(parseInt(url.searchParams.get('limit') || '50') || 50, 100);

	if (before) {
		const beforeId = parseInt(before);
		if (isNaN(beforeId)) {
			throw error(400, 'Invalid before ID');
		}
		return json(getMessagesBeforeId(roomId, beforeId, limit));
	}

	return json(getMessages(roomId, limit));
};
