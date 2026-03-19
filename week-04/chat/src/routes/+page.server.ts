import { redirect, fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { createSession } from '$lib/server/db';

export const load: PageServerLoad = async ({ locals }) => {
	if (locals.session) {
		throw redirect(303, '/chat/lobby');
	}
};

export const actions: Actions = {
	default: async ({ request, cookies }) => {
		const data = await request.formData();
		const nickname = (data.get('nickname') as string)?.trim();

		if (!nickname || nickname.length < 1 || nickname.length > 20) {
			return fail(400, { error: 'Nickname must be 1-20 characters' });
		}

		// Basic sanitization — alphanumeric, spaces, hyphens, underscores
		if (!/^[\w\s\-]+$/.test(nickname)) {
			return fail(400, { error: 'Nickname can only contain letters, numbers, spaces, hyphens, and underscores' });
		}

		const session = createSession(nickname);

		cookies.set('session', session.id, {
			path: '/',
			httpOnly: true,
			sameSite: 'strict',
			maxAge: 60 * 60 * 24 // 24 hours
		});

		throw redirect(303, '/chat/lobby');
	}
};
