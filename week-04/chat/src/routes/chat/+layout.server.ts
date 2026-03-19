import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import { getRooms } from '$lib/server/db';

export const load: LayoutServerLoad = async ({ locals }) => {
	if (!locals.session) {
		throw redirect(303, '/');
	}

	return {
		rooms: getRooms(),
		user: locals.session
	};
};
