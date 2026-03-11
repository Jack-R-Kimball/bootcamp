import { error, fail, redirect } from '@sveltejs/kit'
import type { Actions, PageServerLoad } from './$types'
import type { Balance, SuggestedPayment } from '$lib/types'

/**
 * Debt simplification: given net balances, compute the minimum number of
 * payments needed to zero everyone out.
 *
 * Algorithm (greedy):
 *   1. Split into creditors (positive balance = owed money) and debtors (negative).
 *   2. Sort both descending by magnitude.
 *   3. Pair the largest creditor with the largest debtor. The payment is the
 *      smaller of the two amounts. Reduce both by that amount; whoever hits
 *      zero moves to the next person. Repeat until empty.
 *
 * This produces at most (n - 1) transactions for n people, which is optimal
 * for the greedy case. (True minimum may be lower with circular debts, but
 * the greedy approach is good enough in practice.)
 */
function simplifyDebts(balances: Balance[]): SuggestedPayment[] {
	// Work on copies so we don't mutate the originals
	const creditors = balances
		.filter((b) => b.amount_cents > 0)
		.map((b) => ({ ...b }))
		.sort((a, b) => b.amount_cents - a.amount_cents)

	const debtors = balances
		.filter((b) => b.amount_cents < 0)
		.map((b) => ({ ...b }))
		.sort((a, b) => a.amount_cents - b.amount_cents) // most negative first

	const payments: SuggestedPayment[] = []
	let i = 0 // creditor pointer
	let j = 0 // debtor pointer

	while (i < creditors.length && j < debtors.length) {
		const pay = Math.min(creditors[i].amount_cents, -debtors[j].amount_cents)
		payments.push({
			fromId: debtors[j].user_id,
			fromEmail: debtors[j].email,
			toId: creditors[i].user_id,
			toEmail: creditors[i].email,
			amount_cents: pay
		})
		creditors[i].amount_cents -= pay
		debtors[j].amount_cents += pay
		if (creditors[i].amount_cents === 0) i++
		if (debtors[j].amount_cents === 0) j++
	}

	return payments
}

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

	// Load settlements with payer and payee profiles
	// Two FKs to the same table — use column-name hints to disambiguate
	const { data: settlements } = await locals.supabase
		.from('settlements')
		.select('*, payer:profiles!paid_by(email), payee:profiles!paid_to(email)')
		.eq('group_id', params.id)
		.order('created_at', { ascending: false })

	// --- Compute net balances ---
	// positive amount_cents = this person is owed money (net creditor)
	// negative amount_cents = this person owes money (net debtor)

	const balanceMap = new Map<string, number>()
	const emailMap = new Map<string, string>()

	members?.forEach((m: any) => {
		balanceMap.set(m.user_id, 0)
		emailMap.set(m.user_id, m.profiles?.email ?? m.user_id)
	})

	// Expenses: payer is credited for each non-payer split; non-payer is debited
	expenses?.forEach((exp: any) => {
		exp.expense_splits?.forEach((split: any) => {
			if (split.user_id === exp.paid_by) return
			balanceMap.set(exp.paid_by, (balanceMap.get(exp.paid_by) ?? 0) + split.amount_cents)
			balanceMap.set(split.user_id, (balanceMap.get(split.user_id) ?? 0) - split.amount_cents)
		})
	})

	// Settlements: paid_by reduces their debt (balance goes up);
	// paid_to reduces what they're owed (balance goes down)
	settlements?.forEach((s: any) => {
		balanceMap.set(s.paid_by, (balanceMap.get(s.paid_by) ?? 0) + s.amount_cents)
		balanceMap.set(s.paid_to, (balanceMap.get(s.paid_to) ?? 0) - s.amount_cents)
	})

	const balances: Balance[] = Array.from(balanceMap.entries()).map(([uid, cents]) => ({
		user_id: uid,
		email: emailMap.get(uid) ?? uid,
		amount_cents: cents
	}))

	const suggestedPayments = simplifyDebts(balances)

	return {
		user,
		group,
		members: members ?? [],
		expenses: expenses ?? [],
		settlements: settlements ?? [],
		balances,
		suggestedPayments
	}
}

export const actions: Actions = {
	addMember: async ({ request, locals, params }) => {
		const user = await locals.getUser()
		if (!user) redirect(303, '/login')

		const data = await request.formData()
		const email = (data.get('email') as string)?.trim().toLowerCase()

		if (!email) return fail(400, { memberError: 'Email is required.' })

		const { data: profile } = await locals.supabase
			.from('profiles')
			.select('id')
			.eq('email', email)
			.single()

		if (!profile) return fail(400, { memberError: 'No user found with that email.' })

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

		const allSplitters = Array.from(new Set([user.id, ...splitWith]))
		if (allSplitters.length === 0)
			return fail(400, { expenseError: 'Select at least one person to split with.' })

		const { data: expense, error: expError } = await locals.supabase
			.from('expenses')
			.insert({ group_id: params.id, paid_by: user.id, amount_cents, description })
			.select()
			.single()

		if (expError) return fail(500, { expenseError: expError.message })

		// Read per-member amounts from form (set by the reactive UI)
		const splits = allSplitters.map((uid) => {
			const amtStr = data.get(`split_amount_${uid}`) as string
			const amt = parseFloat(amtStr)
			return {
				expense_id: expense.id,
				user_id: uid,
				amount_cents: isNaN(amt) ? 0 : Math.round(amt * 100)
			}
		})

		await locals.supabase.from('expense_splits').insert(splits)

		return {}
	},

	settle: async ({ request, locals, params }) => {
		const user = await locals.getUser()
		if (!user) redirect(303, '/login')

		const data = await request.formData()
		const paid_by = data.get('paid_by') as string
		const paid_to = data.get('paid_to') as string
		const amountStr = data.get('amount') as string
		const note = (data.get('note') as string)?.trim() || null

		if (!paid_by || !paid_to) return fail(400, { settleError: 'Both parties are required.' })
		if (paid_by === paid_to) return fail(400, { settleError: 'Cannot pay yourself.' })

		const amount = parseFloat(amountStr)
		if (isNaN(amount) || amount <= 0) return fail(400, { settleError: 'Enter a valid amount.' })

		const { error: insertError } = await locals.supabase.from('settlements').insert({
			group_id: params.id,
			paid_by,
			paid_to,
			amount_cents: Math.round(amount * 100),
			note
		})

		if (insertError) return fail(500, { settleError: insertError.message })

		return {}
	}
}
