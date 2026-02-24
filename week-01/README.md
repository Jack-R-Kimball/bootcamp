# Week 01 — Personal Link Dashboard

## Project
A browser new-tab page that organizes bookmarks into categories. Full CRUD: add/edit/delete links and categories. Data persists in a local SQLite database.

## Tech Used
- [Astro](https://astro.build) (SSR, Node adapter) — server framework
- [HTMX](https://htmx.org) — server-driven interactions, no client-side state management
- [Alpine.js](https://alpinejs.dev) — lightweight UI reactivity (show/hide forms)
- [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) — local SQLite database

## How to Run
```bash
cd week-01
npm install
npm run dev
```
Then open [http://localhost:4321](http://localhost:4321) in your browser.

To use as your new tab page, install a browser extension like **New Tab Redirect** (Firefox/Chrome) and point it to `http://localhost:4000`. The dev server must be running.

## Project Structure
```
src/
  lib/
    db.js       # SQLite setup and all database queries
    render.js   # HTML template functions (server-side rendering for HTMX responses)
  pages/
    index.astro          # Main dashboard page
    api/
      categories.js      # POST /api/categories
      categories/[id].js # DELETE /api/categories/:id
      links.js           # POST /api/links
      links/[id].js      # PUT and DELETE /api/links/:id
data/
  dashboard.db  # SQLite database file (gitignored, created on first run)
```

## Notes
- All mutations return the full updated categories HTML — HTMX swaps it into `#categories`
- Alpine.js handles show/hide of add/edit forms; its MutationObserver picks up newly swapped content automatically
- The `data/` directory is gitignored; the database is local only
