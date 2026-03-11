# Splittify

A Splitwise-style shared expense tracker — bootcamp week-03 project. Groups of people log expenses over time, track who owes whom, and settle up with the minimum number of transactions.

## Stack

- **SvelteKit 5** (SSR, form actions, runes)
- **Supabase** (PostgreSQL + Auth)
- **Tailwind CSS** + `@tailwindcss/forms`
- **TypeScript**

## Features

- Email/password auth (register, login, logout)
- Create expense groups; invite members by email
- Add expenses with editable per-member split amounts
  - Auto-calculates equal splits when total is entered
  - Live remainder indicator (unaccounted / over total)
- Record settlements (cash payments between members)
  - One-click record from suggested payment list
  - Or enter a manual payment with optional note
- **Debt simplification**: computes the minimum number of payments needed to zero all balances (greedy algorithm, at most n−1 transactions for n members)
- Net balance display: who is owed what across all group history
- Activity timeline: expenses and settlements intermixed chronologically

## How it works

The app follows the Splitwise model:

1. Expenses accumulate over time — one person pays, the cost is split among members
2. Balances reflect the running net across all expenses and settlements
3. At any point, "To settle up" shows the fewest payments needed to zero everyone out
4. Settlements (cash payments) reduce balances when recorded

## Development

```sh
npm install
npm run dev           # http://localhost:5173
npm run dev -- --host # expose to LAN/Tailscale (e.g. http://10.x.x.x:5173)
```

Requires a `.env.local` file:

```
PUBLIC_SUPABASE_URL=https://your-project.supabase.co
PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

## Build

```sh
npm run build
npm run preview
```

## Database

Run the following in the Supabase SQL editor to set up the schema:

**Core tables:**
- `profiles` — auto-created on signup via trigger
- `groups` / `group_members`
- `expenses` / `expense_splits`
- `settlements` — records cash payments between members

**FK note:** Foreign keys on `group_members.user_id`, `expenses.paid_by`, `expense_splits.user_id`, `settlements.paid_by`, and `settlements.paid_to` must reference `profiles(id)` (not `auth.users(id)`) for Supabase/PostgREST to resolve joined queries.

## Debt Simplification Algorithm

Located in `src/routes/groups/[id]/+page.server.ts` (`simplifyDebts()`).

Given net balances (positive = owed money, negative = owes money):
1. Split into creditors and debtors, sort each by magnitude descending
2. Pair the largest creditor with the largest debtor
3. The payment amount is the minimum of the two
4. Reduce both by that amount; whoever reaches zero advances to the next person
5. Repeat until all balances are zeroed

This produces at most n−1 transactions for n members. The greedy approach is optimal for most real-world cases; true minimum may be lower when circular debts exist (NP-hard to solve exactly).

## Security Notes

> **This project has known security issues — it is a learning exercise, not production-ready.**

1. **Row Level Security (RLS) is disabled** on all tables. Any authenticated user can read and modify any data in the database. RLS policies were scaffolded in the schema but disabled during development due to `auth.uid()` returning null in server-side actions (session cookie propagation issue with `@supabase/ssr`). Before deploying publicly, RLS must be re-enabled and the policies debugged.

2. **No authorization checks on group membership** beyond the server-side load function. A user who knows a group UUID can potentially access it via direct API calls.

3. **No entry verification or audit trail.** Any member can add or modify expenses. A production system would require: confirmation from affected parties, immutable entries with correction-only edits, and notifications on all changes. The app relies on social trust among group members, which mirrors how real-world small-group expense tracking works in practice.

4. **Supabase anon key is public** — expected and safe only if RLS is properly configured.

## Project Structure

```
src/
  hooks.server.ts          # Supabase client + auth middleware
  app.d.ts                 # TypeScript: locals, PageData
  lib/
    types.ts               # Shared types (Group, Member, Expense, Balance,
                           #   Settlement, SuggestedPayment)
  routes/
    +layout.server.ts      # Loads user for all routes
    +layout.svelte         # Nav bar
    +page.svelte           # Landing page
    register/              # Sign-up form
    login/                 # Sign-in form
    dashboard/             # Group list + create group
    groups/[id]/           # Group detail:
                           #   +page.server.ts  load, addMember, addExpense,
                           #                    settle actions + simplifyDebts()
                           #   +page.svelte     split form, activity timeline,
                           #                    balances, suggested payments,
                           #                    record payment form
```
