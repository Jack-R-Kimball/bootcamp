import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getRooms, getMessages } from '$lib/server/db';

export const load: PageServerLoad = async ({ params }) => {
	const roomSlug = decodeURIComponent(params.room).toLowerCase();
	const rooms = getRooms();
	const room = rooms.find((r) => r.name.toLowerCase() === roomSlug);

	if (!room) {
		throw error(404, 'Room not found');
	}

	const messages = getMessages(room.id, 50);

	return {
		room,
		messages
	};
};
