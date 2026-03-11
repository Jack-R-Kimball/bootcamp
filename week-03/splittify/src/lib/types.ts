export type Profile = {
	id: string
	email: string
	display_name: string | null
	created_at: string
}

export type Group = {
	id: string
	name: string
	created_by: string
	created_at: string
}

export type GroupMember = {
	group_id: string
	user_id: string
	joined_at: string
	profiles?: Profile
}

export type Expense = {
	id: string
	group_id: string
	paid_by: string
	amount_cents: number
	description: string
	created_at: string
	profiles?: Profile
}

export type ExpenseSplit = {
	id: string
	expense_id: string
	user_id: string
	amount_cents: number
	profiles?: Profile
}

export type Settlement = {
	id: string
	group_id: string
	paid_by: string
	paid_to: string
	amount_cents: number
	note: string | null
	created_at: string
}

// Computed balance: positive = owed to you, negative = you owe
export type Balance = {
	user_id: string
	email: string
	amount_cents: number
}

// One leg of the minimum-transaction settlement plan
export type SuggestedPayment = {
	fromId: string
	fromEmail: string
	toId: string
	toEmail: string
	amount_cents: number
}
