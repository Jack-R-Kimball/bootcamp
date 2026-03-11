<script lang="ts">
	import type { PageData, ActionData } from './$types'
	let { data, form }: { data: PageData; form: ActionData } = $props()

	function formatCents(cents: number): string {
		return (Math.abs(cents) / 100).toFixed(2)
	}
</script>

<div class="mb-6">
	<a href="/dashboard" class="text-sm text-gray-500 hover:text-gray-300">← Back to groups</a>
	<h1 class="mt-2 text-2xl font-bold">{data.group.name}</h1>
</div>

<div class="grid grid-cols-1 gap-6 lg:grid-cols-3">

	<!-- Left: Expenses + Add Expense -->
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
					placeholder="Amount ($)"
					required
					class="w-full rounded-lg border border-gray-700 bg-gray-800 px-4 py-2 text-sm focus:border-indigo-500 focus:outline-none"
				/>
				<div>
					<p class="text-sm text-gray-400 mb-2">Split with:</p>
					<div class="space-y-1.5">
						{#each data.members as member}
							{@const profile = (member as any).profiles}
							{@const isMe = member.user_id === data.user.id}
							<label class="flex items-center gap-2 text-sm">
								<input
									type="checkbox"
									name="split_with"
									value={member.user_id}
									checked={true}
									disabled={isMe}
									class="rounded"
								/>
								<span class={isMe ? 'text-gray-500' : ''}>
									{profile?.email ?? member.user_id}{isMe ? ' (you)' : ''}
								</span>
							</label>
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

		<!-- Expense list -->
		<div class="rounded-lg border border-gray-800 bg-gray-900 p-5">
			<h2 class="font-semibold mb-4">Expenses</h2>
			{#if data.expenses.length === 0}
				<p class="text-sm text-gray-500">No expenses yet.</p>
			{:else}
				<div class="space-y-3">
					{#each data.expenses as expense}
						{@const payer = (expense as any).profiles}
						{@const splits = (expense as any).expense_splits ?? []}
						<div class="border-b border-gray-800 pb-3 last:border-0 last:pb-0">
							<div class="flex justify-between items-start">
								<div>
									<p class="font-medium">{expense.description}</p>
									<p class="text-sm text-gray-400">
										Paid by {payer?.email ?? 'unknown'} ·
										split {splits.length} way{splits.length !== 1 ? 's' : ''}
									</p>
								</div>
								<span class="font-semibold text-green-400">
									${(expense.amount_cents / 100).toFixed(2)}
								</span>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	</div>

	<!-- Right: Members + Balances -->
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
			{#if data.balances.every((b) => b.amount_cents === 0)}
				<p class="text-sm text-gray-500">All settled up!</p>
			{:else}
				<ul class="space-y-2">
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
			{/if}
		</div>
	</div>
</div>
