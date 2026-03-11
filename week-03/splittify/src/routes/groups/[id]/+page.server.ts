import { error, fail, redirect } from '@sveltejs/kit'
import type { Actions, PageServerLoad } from './$types'
import type { Balance } from '$lib/types'

export const load: PageServerLoad = async ({ locals, params }) => {
	const user = await locals.getUser()
	if (!user) redirect(303, '/login')

	// Verify membership
	const { data: membership } = await locals.supabase
		.from('group_members')
		.select('group_id')
		.eq('group_id', params.id)
		.eq('user_id', user.id)
		.single()

	if (!membership) error(403, 'You are not a member of this group.')

	// Load group
	const { data: group } = await locals.supabase
		.from('groups')
		.select('*')
		.eq('id', params.id)
		.single()

	if (!group) error(404, 'Group not found.')

	// Load members with profiles
	const { data: members } = await locals.supabase
		.from('group_members')
		.select('user_id, joined_at, profiles(id, email, display_name)')
		.eq('group_id', params.id)

	// Load expenses with payer profile and splits
	const { data: expenses } = await locals.supabase
		.from('expenses')
		.select('*, profiles(email, display_name), expense_splits(user_id, amount_cents, profiles(email))')
		.eq('group_id', params.id)
		.order('created_at', { ascending: false })

	// Compute balances
	// For each expense: payer is owed the split amounts from everyone else
	const balanceMap = new Map<string, number>()
	const emailMap = new Map<string, string>()

	members?.forEach((m: any) => {
		balanceMap.set(m.user_id, 0)
		emailMap.set(m.user_id, m.profiles?.email ?? m.user_id)
	})

	expenses?.forEach((exp: any) => {
		exp.expense_splits?.forEach((split: any) => {
			if (split.user_id === exp.paid_by) return
			// payer is owed split.amount_cents from split.user_id
			balanceMap.set(exp.paid_by, (balanceMap.get(exp.paid_by) ?? 0) + split.amount_cents)
			balanceMap.set(split.user_id, (balanceMap.get(split.user_id) ?? 0) - split.amount_cents)
		})
	})

	const balances: Balance[] = Array.from(balanceMap.entries()).map(([uid, cents]) => ({
		user_id: uid,
		email: emailMap.get(uid) ?? uid,
		amount_cents: cents
	}))

	return { user, group, members: members ?? [], expenses: expenses ?? [], balances }
}

export const actions: Actions = {
	addMember: async ({ request, locals, params }) => {
		const user = await locals.getUser()
		if (!user) redirect(303, '/login')

		const data = await request.formData()
		const email = (data.get('email') as string)?.trim().toLowerCase()

		if (!email) return fail(400, { memberError: 'Email is required.' })

		// Look up profile by email
		const { data: profile } = await locals.supabase
			.from('profiles')
			.select('id')
			.eq('email', email)
			.single()

		if (!profile) return fail(400, { memberError: 'No user found with that email.' })

		// Check not already a member
		const { data: existing } = await locals.supabase
			.from('group_members')
			.select('user_id')
			.eq('group_id', params.id)
			.eq('user_id', profile.id)
			.single()

		if (existing) return fail(400, { memberError: 'That person is already in this group.' })

		const { error: insertError } = await locals.supabase
			.from('group_members')
			.insert({ group_id: params.id, user_id: profile.id })

		if (insertError) return fail(500, { memberError: insertError.message })

		return { memberSuccess: `${email} added to the group.` }
	},

	addExpense: async ({ request, locals, params }) => {
		const user = await locals.getUser()
		if (!user) redirect(303, '/login')

		const data = await request.formData()
		const description = (data.get('description') as string)?.trim()
		const amountStr = data.get('amount') as string
		const splitWith = data.getAll('split_with') as string[]

		if (!description) return fail(400, { expenseError: 'Description is required.' })

		const amount = parseFloat(amountStr)
		if (isNaN(amount) || amount <= 0) return fail(400, { expenseError: 'Enter a valid amount.' })

		const amount_cents = Math.round(amount * 100)

		// splitWith = other members to split with (payer always included)
		const allSplitters = [user.id, ...splitWith.filter((id) => id !== user.id)]
		if (allSplitters.length === 0) return fail(400, { expenseError: 'Select at least one person to split with.' })

		const splitAmount = Math.floor(amount_cents / allSplitters.length)
		const remainder = amount_cents - splitAmount * allSplitters.length

		const { data: expense, error: expError } = await locals.supabase
			.from('expenses')
			.insert({ group_id: params.id, paid_by: user.id, amount_cents, description })
			.select()
			.single()

		if (expError) return fail(500, { expenseError: expError.message })

		// Insert splits (add remainder to first splitter)
		const splits = allSplitters.map((uid, i) => ({
			expense_id: expense.id,
			user_id: uid,
			amount_cents: i === 0 ? splitAmount + remainder : splitAmount
		}))

		await locals.supabase.from('expense_splits').insert(splits)

		return {}
	}
}
