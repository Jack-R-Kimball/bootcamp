# Splittify

A shared expense tracker — bootcamp week-03 project. Split group expenses and track who owes what.

## Stack

- **SvelteKit 5** (SSR, form actions)
- **Supabase** (PostgreSQL + Auth)
- **Tailwind CSS** + `@tailwindcss/forms`
- **TypeScript**

## Features

- Email/password auth (register, login, logout)
- Create expense groups
- Add members by email
- Add expenses with equal splits
- Live balance calculation per member

## Development

```sh
npm install
npm run dev        # http://localhost:5173
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

Schema is in `supabase/schema.sql`. Run it in the Supabase SQL editor to set up:
- `profiles` — auto-created on signup via trigger
- `groups` / `group_members`
- `expenses` / `expense_splits`

## Security Notes

> **This project has known security issues — it is a learning exercise, not production-ready.**

1. **Row Level Security (RLS) is disabled** on all tables. Any authenticated user can read and modify any data in the database. RLS policies were scaffolded in the schema but disabled during development due to `auth.uid()` returning null in server-side actions (likely a session cookie propagation issue with `@supabase/ssr`). Before deploying publicly, RLS must be re-enabled and the policies debugged.

2. **No authorization checks on group membership** beyond the server-side load function. A user who knows a group UUID can potentially access it via direct API calls.

3. **No input sanitization** beyond basic HTML `required` attributes and server-side null checks.

4. **Supabase anon key is public** (in `PUBLIC_SUPABASE_URL` / `PUBLIC_SUPABASE_ANON_KEY`) — this is expected and safe only if RLS is properly configured. Without RLS, the anon key grants full table access.

## Project Structure

```
src/
  hooks.server.ts          # Supabase client + auth middleware
  app.d.ts                 # TypeScript: locals, PageData
  lib/
    types.ts               # Shared types (Group, Member, Expense, Balance)
  routes/
    +layout.server.ts      # Loads user for all routes
    +layout.svelte         # Nav bar
    +page.svelte           # Landing page
    register/              # Sign-up form
    login/                 # Sign-in form
    dashboard/             # Group list + create group
    groups/[id]/           # Group detail: members, expenses, balances
```
