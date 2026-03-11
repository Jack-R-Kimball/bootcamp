import { fail, redirect } from '@sveltejs/kit'
import type { Actions, PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ locals }) => {
	const user = await locals.getUser()
	if (user) redirect(303, '/dashboard')
	return {}
}

export const actions: Actions = {
	default: async ({ request, locals }) => {
		const data = await request.formData()
		const email = data.get('email') as string
		const password = data.get('password') as string

		const { error } = await locals.supabase.auth.signInWithPassword({ email, password })

		if (error) {
			return fail(400, { error: 'Invalid email or password.', email })
		}

		redirect(303, '/dashboard')
	}
}
