import { fail, redirect } from '@sveltejs/kit'
import type { Actions, PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ locals }) => {
	const user = await locals.getUser()
	if (!user) redirect(303, '/login')

	const { data: groups } = await locals.supabase
		.from('group_members')
		.select('group_id, groups(id, name, created_at)')
		.eq('user_id', user.id)
		.order('joined_at', { ascending: false })

	return {
		user,
		groups: groups?.map((g: any) => g.groups).filter(Boolean) ?? []
	}
}

export const actions: Actions = {
	createGroup: async ({ request, locals }) => {
		const user = await locals.getUser()
		if (!user) redirect(303, '/login')

		const data = await request.formData()
		const name = (data.get('name') as string)?.trim()

		if (!name) return fail(400, { error: 'Group name is required.' })

		const { data: group, error } = await locals.supabase
			.from('groups')
			.insert({ name, created_by: user.id })
			.select()
			.single()

		if (error) return fail(500, { error: error.message })

		// Add creator as first member
		await locals.supabase
			.from('group_members')
			.insert({ group_id: group.id, user_id: user.id })

		redirect(303, `/groups/${group.id}`)
	},

	logout: async ({ locals }) => {
		await locals.supabase.auth.signOut()
		redirect(303, '/login')
	}
}
