import type { Handle } from '@sveltejs/kit';
import { getSession, updateLastSeen } from '$lib/server/db';

export const handle: Handle = async ({ event, resolve }) => {
	const sessionId = event.cookies.get('session');
	if (sessionId) {
		const session = getSession(sessionId);
		if (session) {
			event.locals.session = {
				id: session.id,
				nickname: session.nickname,
				color: session.color
			};
			updateLastSeen(session.id);
		} else {
			event.locals.session = null;
			event.cookies.delete('session', { path: '/' });
		}
	} else {
		event.locals.session = null;
	}

	return resolve(event);
};
