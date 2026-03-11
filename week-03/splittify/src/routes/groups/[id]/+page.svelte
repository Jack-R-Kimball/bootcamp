<script lang="ts">
	import type { PageData, ActionData } from './$types'
	let { data, form }: { data: PageData; form: ActionData } = $props()

	function formatCents(cents: number): string {
		return (Math.abs(cents) / 100).toFixed(2)
	}

	// --- Add Expense form reactive state ---

	let expenseAmountStr = $state('')

	// Track which members are unchecked (default: all checked)
	let unchecked = $state<Record<string, boolean>>({})

	function isChecked(uid: string): boolean {
		return !unchecked[uid]
	}

	let memberAmountStrs = $state<Record<string, string>>({})

	// Recalculate equal splits when total or selection changes
	$effect(() => {
		const totalCents = Math.round((parseFloat(expenseAmountStr) || 0) * 100)
		const selected = data.members.filter((m: any) => isChecked(m.user_id))

		if (totalCents <= 0 || selected.length === 0) {
			data.members.forEach((m: any) => {
				memberAmountStrs[m.user_id] = ''
			})
			return
		}

		const share = Math.floor(totalCents / selected.length)
		const remainder = totalCents - share * selected.length

		selected.forEach((m: any, i: number) => {
			memberAmountStrs[m.user_id] = ((i === 0 ? share + remainder : share) / 100).toFixed(2)
		})
		data.members
			.filter((m: any) => !isChecked(m.user_id))
			.forEach((m: any) => {
				memberAmountStrs[m.user_id] = ''
			})
	})

	let splitSum = $derived(
		Object.values(memberAmountStrs).reduce((s, v) => s + (parseFloat(v) || 0), 0)
	)
	let expenseTotal = $derived(parseFloat(expenseAmountStr) || 0)
	let splitRemainder = $derived(Math.round((expenseTotal - splitSum) * 100) / 100)

	// --- Combined activity timeline ---
	type ActivityItem =
		| { type: 'expense'; created_at: string; data: any }
		| { type: 'settlement'; created_at: string; data: any }

	let activity = $derived<ActivityItem[]>(
		[
			...data.expenses.map((e: any) => ({ type: 'expense' as const, created_at: e.created_at, data: e })),
			...data.settlements.map((s: any) => ({ type: 'settlement' as const, created_at: s.created_at, data: s }))
		].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
	)

	let allSettled = $derived(data.balances.every((b: any) => b.amount_cents === 0))
</script>

<div class="mb-6">
	<a href="/dashboard" class="text-sm text-gray-500 hover:text-gray-300">← Back to groups</a>
	<h1 class="mt-2 text-2xl font-bold">{data.group.name}</h1>
</div>

<div class="grid grid-cols-1 gap-6 lg:grid-cols-3">

	<!-- Left: Add Expense + Activity -->
	<div class="lg:col-span-2 space-y-6">

		<!-- Add Expense -->
		<div class="rounded-lg border border-gray-800 bg-gray-900 p-5">
			<h2 class="font-semibold mb-4">Add Expense</h2>

			{#if form?.expenseError}
				<p class="mb-3 text-sm text-red-400">{form.expenseError}</p>
			{/if}

			<form method="POST" action="?/addExpense" class="space-y-3">
				<input
					name="description"
					type="text"
					placeholder="What was it for?"
					required
					class="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2 text-sm focus:border-indigo-500 focus:outline-none"
				/>
				<input
					name="amount"
					type="number"
					step="0.01"
					min="0.01"
					placeholder="Total amount ($)"
					required
					bind:value={expenseAmountStr}
					class="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2 text-sm focus:border-indigo-500 focus:outline-none"
				/>

				<div>
					<div class="flex items-baseline justify-between mb-2">
						<p class="text-sm text-gray-400">Split with:</p>
						{#if expenseTotal > 0}
							{#if Math.abs(splitRemainder) < 0.01}
								<span class="text-xs text-green-400">Fully accounted</span>
							{:else if splitRemainder > 0}
								<span class="text-xs text-yellow-400">${splitRemainder.toFixed(2)} unaccounted</span>
							{:else}
								<span class="text-xs text-red-400">${Math.abs(splitRemainder).toFixed(2)} over total</span>
							{/if}
						{/if}
					</div>

					<div class="space-y-2">
						{#each data.members as member}
							{@const profile = (member as any).profiles}
							{@const isMe = member.user_id === data.user.id}
							<div class="flex items-center gap-2">
								<input
									type="checkbox"
									checked={isChecked(member.user_id)}
									onchange={(e) => { unchecked[member.user_id] = !e.currentTarget.checked }}
									disabled={isMe}
									class="rounded"
								/>
								<span class="flex-1 text-sm {isMe ? 'text-gray-500' : 'text-gray-300'}">
									{profile?.email ?? member.user_id}{isMe ? ' (you)' : ''}
								</span>
								{#if isChecked(member.user_id)}
									<input
										type="number"
										name="split_amount_{member.user_id}"
										step="0.01"
										min="0"
										bind:value={memberAmountStrs[member.user_id]}
										placeholder="0.00"
										class="w-24 rounded-lg border border-gray-700 bg-gray-800 px-2 py-1 text-sm text-right focus:border-indigo-500 focus:outline-none"
									/>
									<input type="hidden" name="split_with" value={member.user_id} />
								{/if}
							</div>
						{/each}
					</div>
				</div>

				<button
					type="submit"
					class="w-full rounded-lg bg-indigo-600 py-2 text-sm font-semibold hover:bg-indigo-500 transition-colors"
				>
					Add expense
				</button>
			</form>
		</div>

		<!-- Activity timeline -->
		<div class="rounded-lg border border-gray-800 bg-gray-900 p-5">
			<h2 class="font-semibold mb-4">Activity</h2>
			{#if activity.length === 0}
				<p class="text-sm text-gray-500">No activity yet.</p>
			{:else}
				<div class="space-y-4">
					{#each activity as item}
						{#if item.type === 'expense'}
							{@const exp = item.data}
							{@const payer = exp.profiles}
							{@const splits = exp.expense_splits ?? []}
							{@const splitTotal = splits.reduce((s: number, sp: any) => s + sp.amount_cents, 0)}
							{@const unaccounted = exp.amount_cents - splitTotal}
							<div class="border-b border-gray-800 pb-4 last:border-0 last:pb-0">
								<div class="flex justify-between items-start mb-2">
									<div>
										<p class="font-medium">{exp.description}</p>
										<p class="text-xs text-gray-500 mt-0.5">
											Paid by {payer?.email ?? 'unknown'} ·
											{new Date(exp.created_at).toLocaleDateString()}
										</p>
									</div>
									<span class="font-semibold text-green-400 ml-4">
										${(exp.amount_cents / 100).toFixed(2)}
									</span>
								</div>
								{#if splits.length > 0}
									<div class="bg-gray-800/50 rounded-lg px-3 py-2 space-y-1">
										{#each splits as split}
											{@const sp = (split as any).profiles}
											<div class="flex justify-between text-xs">
												<span class="text-gray-400">{sp?.email ?? split.user_id}</span>
												<span class="text-gray-300">${(split.amount_cents / 100).toFixed(2)}</span>
											</div>
										{/each}
										{#if Math.abs(unaccounted) > 0}
											<div class="flex justify-between text-xs pt-1 border-t border-gray-700 text-yellow-400">
												<span>Unaccounted</span>
												<span>{unaccounted > 0 ? '+' : '-'}${(Math.abs(unaccounted) / 100).toFixed(2)}</span>
											</div>
										{/if}
									</div>
								{/if}
							</div>
						{:else}
							{@const s = item.data}
							<div class="border-b border-gray-800 pb-4 last:border-0 last:pb-0">
								<div class="flex justify-between items-center">
									<div>
										<p class="text-sm text-gray-300">
											<span class="text-indigo-400">{s.payer?.email ?? s.paid_by}</span>
											paid
											<span class="text-indigo-400">{s.payee?.email ?? s.paid_to}</span>
										</p>
										{#if s.note}
											<p class="text-xs text-gray-500 mt-0.5">"{s.note}"</p>
										{/if}
										<p class="text-xs text-gray-600 mt-0.5">
											Settlement · {new Date(s.created_at).toLocaleDateString()}
										</p>
									</div>
									<span class="font-semibold text-indigo-400 ml-4">
										${(s.amount_cents / 100).toFixed(2)}
									</span>
								</div>
							</div>
						{/if}
					{/each}
				</div>
			{/if}
		</div>
	</div>

	<!-- Right: Members + Balances + Record Payment -->
	<div class="space-y-6">

		<!-- Members -->
		<div class="rounded-lg border border-gray-800 bg-gray-900 p-5">
			<h2 class="font-semibold mb-4">Members</h2>
			<ul class="space-y-2 mb-4">
				{#each data.members as member}
					{@const profile = (member as any).profiles}
					<li class="text-sm text-gray-300">
						{profile?.email ?? member.user_id}
						{#if member.user_id === data.user.id}
							<span class="text-gray-600"> (you)</span>
						{/if}
					</li>
				{/each}
			</ul>

			{#if form?.memberError}
				<p class="mb-2 text-sm text-red-400">{form.memberError}</p>
			{/if}
			{#if form?.memberSuccess}
				<p class="mb-2 text-sm text-green-400">{form.memberSuccess}</p>
			{/if}

			<form method="POST" action="?/addMember" class="flex gap-2">
				<input
					name="email"
					type="email"
					placeholder="Invite by email"
					class="flex-1 rounded-lg border border-gray-700 bg-gray-800 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none"
				/>
				<button
					type="submit"
					class="rounded-lg bg-gray-700 px-3 py-1.5 text-sm hover:bg-gray-600 transition-colors"
				>
					Add
				</button>
			</form>
		</div>

		<!-- Balances -->
		<div class="rounded-lg border border-gray-800 bg-gray-900 p-5">
			<h2 class="font-semibold mb-4">Balances</h2>
			{#if allSettled}
				<p class="text-sm text-gray-500">All settled up!</p>
			{:else}
				<!-- Raw net balances -->
				<ul class="space-y-1.5 mb-5">
					{#each data.balances as balance}
						{#if balance.amount_cents !== 0}
							<li class="text-sm">
								<span class="text-gray-300">{balance.email}</span>
								{#if balance.amount_cents > 0}
									<span class="text-green-400 ml-1">is owed ${formatCents(balance.amount_cents)}</span>
								{:else}
									<span class="text-red-400 ml-1">owes ${formatCents(balance.amount_cents)}</span>
								{/if}
							</li>
						{/if}
					{/each}
				</ul>

				<!-- Suggested payments (minimum transactions) -->
				<div class="border-t border-gray-800 pt-4">
					<p class="text-xs text-gray-500 uppercase tracking-wide mb-3">To settle up</p>
					<div class="space-y-2">
						{#each data.suggestedPayments as payment}
							<form method="POST" action="?/settle" class="flex items-center justify-between gap-2">
								<input type="hidden" name="paid_by" value={payment.fromId} />
								<input type="hidden" name="paid_to" value={payment.toId} />
								<input type="hidden" name="amount" value={(payment.amount_cents / 100).toFixed(2)} />
								<p class="text-sm text-gray-300 flex-1">
									{payment.fromEmail} →
									<span class="text-gray-100">{payment.toEmail}</span>
									<span class="text-green-400 ml-1">${(payment.amount_cents / 100).toFixed(2)}</span>
								</p>
								<button
									type="submit"
									class="shrink-0 rounded bg-gray-700 px-2 py-1 text-xs hover:bg-gray-600 transition-colors"
								>
									Record
								</button>
							</form>
						{/each}
					</div>
				</div>
			{/if}
		</div>

		<!-- Record Payment (manual) -->
		<div class="rounded-lg border border-gray-800 bg-gray-900 p-5">
			<h2 class="font-semibold mb-4">Record Payment</h2>

			{#if form?.settleError}
				<p class="mb-3 text-sm text-red-400">{form.settleError}</p>
			{/if}

			<form method="POST" action="?/settle" class="space-y-3">
				<div class="flex items-center gap-2 text-sm">
					<select
						name="paid_by"
						required
						class="flex-1 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
					>
						<option value="" disabled selected>Who paid</option>
						{#each data.members as member}
							{@const profile = (member as any).profiles}
							<option value={member.user_id}>{profile?.email ?? member.user_id}</option>
						{/each}
					</select>
					<span class="text-gray-500 shrink-0">paid</span>
					<select
						name="paid_to"
						required
						class="flex-1 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
					>
						<option value="" disabled selected>Who received</option>
						{#each data.members as member}
							{@const profile = (member as any).profiles}
							<option value={member.user_id}>{profile?.email ?? member.user_id}</option>
						{/each}
					</select>
				</div>
				<input
					name="amount"
					type="number"
					step="0.01"
					min="0.01"
					placeholder="Amount ($)"
					required
					class="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2 text-sm focus:border-indigo-500 focus:outline-none"
				/>
				<input
					name="note"
					type="text"
					placeholder="Note (optional)"
					class="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2 text-sm focus:border-indigo-500 focus:outline-none"
				/>
				<button
					type="submit"
					class="w-full rounded-lg bg-gray-700 py-2 text-sm font-semibold hover:bg-gray-600 transition-colors"
				>
					Record payment
				</button>
			</form>
		</div>
	</div>
</div>
