# Personal Link Dashboard

A self-hosted personal link dashboard built with Astro SSR, HTMX, Alpine.js, and SQLite — sometimes called the "AHA stack." Organizes bookmarks into panels and categories with drag-and-drop, full-text search, tag browsing, and automatic description fetching.

Runs as a Docker/Podman container. A companion Firefox extension saves pages directly from the browser toolbar.

---

## Features

### Links & Organization
- Links organized into **panels** (tabs) and **categories** (cards within each panel)
- Each link stores a name, URL, description, keyword, and comma-separated tags
- Hover over a link to see a detail overlay card with full description, tags, and URL
- **Drag-and-drop** reordering for panels, categories, and links via SortableJS
- **Cross-category drag**: drag a link from one category and drop it into another
- **Cross-panel drag**: drag a category by its handle onto a panel tab to move the whole category (and all its links) to that panel

### Multi-select & Bulk Move
- **Ctrl+click** to toggle individual link selection; **Shift+click** to select a range
- A selection bar appears showing the count and dropdowns to choose a destination panel and category
- **Move** sends all selected links to the chosen destination in one operation

### Search
- Header search bar with 300ms debounce — results appear as you type
- Toggle **case-sensitive** mode (Aa button)
- Toggle **current panel / all panels** scope
- Results grouped by panel header → category card → link items

### Tag Browser
- Hamburger menu → **browse tags** fetches all tags from the database
- Tags displayed alphabetically in collapsible `<details>` sections with link counts
- Clicking a section expands the list of links carrying that tag

### Description Fetching & Status Dots
- Hamburger menu → **fetch descriptions** triggers a background fetch of all links that don't yet have a description (or have a very short one)
- The server fetches each URL sequentially (400ms pause between requests), extracts `meta name="description"`, `og:description`, or `twitter:description`, and stores it in the database
- Progress streams back to the browser via Server-Sent Events: `[N%] done/total — link name`
- Each link gets a **status dot** (visible in the drag-handle area, fades on hover):
  - **Green** — description found and stored
  - **Yellow** — site reachable but no meta description (paywalled, SPA, blocked)
  - **Red** — dead link (404, 410, connection refused, DNS failure)
  - **Blue** — LAN/localhost URL, skipped
- Already-processed links (any status set) are skipped on subsequent runs

### Import
- `/import` page accepts JSON (array of `{name, url, description, tags, keyword, panel, category}`) or HTML Netscape bookmark files exported from any browser
- Panels and categories are created automatically if they don't exist

### UI & Layout
- **Compact layout** toggle (narrower columns → more columns per row)
- **Dark / Light / Auto** theme (respects system preference, overridable)
- Keyboard shortcuts **1–9** to switch between panels
- Responsive — collapses gracefully on mobile/touch screens

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | [Astro](https://astro.build) SSR (`output: server`, Node adapter) |
| Interactivity | [HTMX](https://htmx.org) v2 for server-driven swaps |
| Reactive UI | [Alpine.js](https://alpinejs.dev) for local state (menus, forms, clock) |
| Database | SQLite via [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) |
| Drag-and-drop | [SortableJS](https://sortablejs.github.io/Sortable/) |
| Container | Docker / Podman |

Server-rendered HTML is returned directly from API endpoints and swapped into the page by HTMX — no client-side JSON parsing or state management for data operations.

---

## Running with Docker / Podman

```bash
# Pull and start (uses a named volume for the database)
podman-compose up -d

# The dashboard is available at http://localhost:4321
```

The database is stored in the `dashboard-data` named volume at `/data/dashboard.db` inside the container. Schema migrations run automatically on startup.

### Building locally after code changes

```bash
./update.sh
```

This rebuilds the Astro app, builds a new container image, and restarts the service. The database volume is preserved across restarts.

---

## Firefox Extension

The `dashboard-save-ext/` directory contains a Firefox extension that adds a toolbar button. Clicking it opens a small popup pointing at your dashboard's `/save` page, pre-filled with the current tab's URL and title.

The dashboard URL defaults to `http://100.107.254.10:4321` (Tailscale) and can be changed via the extension's options page (right-click the toolbar button → Manage Extension → Preferences).

The extension is signed via AMO self-distribution. Install the `.xpi` by dragging it into Firefox, or by navigating to a hosted copy of it in Firefox (which prompts installation). On Android Firefox, enable "Install extension from file" by tapping the Firefox version number five times in Settings.

---

## Database Schema

```
panels      id, name, position
categories  id, name, panel_id, position
links       id, category_id, name, url, description, tags, keyword, position, status
```

Migrations are idempotent `ALTER TABLE` statements that run on every startup — safe to re-run, duplicate column errors are swallowed silently.

---

## Configuration

| Environment variable | Default | Description |
|---------------------|---------|-------------|
| `HOST` | `0.0.0.0` | Interface to bind |
| `PORT` | `4321` | Port to listen on |
| `DASHBOARD_DATA_DIR` | `../data` (relative to `src/lib/`) | Directory for `dashboard.db` |
