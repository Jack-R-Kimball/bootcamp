# Link Dashboard

A self-hosted personal bookmark dashboard. Organize links into panels and categories, drag to reorder, import from any browser, and save pages with a one-click bookmarklet.

All data is stored locally in a SQLite database — nothing leaves your machine.

## Quick Start

### Docker
```bash
docker compose up -d
```

### Podman (v4+)
```bash
podman compose up -d
```

### Podman (v3.x)

Podman 3.x has a known issue with CNI bridge networking. Use `network_mode: host` in `docker-compose.yml` instead of `ports`:

```yaml
    network_mode: host
    # ports:          ← remove this
    #   - "4321:4321" ← remove this
```

Then:
```bash
podman-compose up -d
```

Open **http://localhost:4321**

To use as your browser new-tab page, install **New Tab Redirect** (Firefox/Chrome) and point it to `http://localhost:4321`.

## docker-compose.yml

If you don't want to clone the repo, just create this file and run one of the commands above:

```yaml
services:
  dashboard:
    image: ghcr.io/jack-r-kimball/link-dashboard:latest
    ports:
      - "4321:4321"
    volumes:
      - dashboard-data:/data
    restart: unless-stopped

volumes:
  dashboard-data:
    name: dashboard-data
```

Pin to a specific version for stability (e.g. `link-dashboard:1.0`).

## Data

All bookmarks are stored in a named Docker volume (`dashboard-data`). The volume persists across container updates and is never included in the image. To back it up:

```bash
docker run --rm -v dashboard-data:/data -v $(pwd):/backup alpine \
  tar czf /backup/dashboard-backup.tar.gz -C /data .
```

## Importing Bookmarks

Navigate to **http://localhost:4321/import** and drag in your browser's exported bookmarks HTML file.

| Browser | Export path |
|---|---|
| Firefox | Bookmarks → Manage Bookmarks → Import and Backup → Export Bookmarks to HTML |
| Chrome / Edge | Bookmarks → Bookmark Manager → ⋮ → Export bookmarks |
| Safari | File → Export → Bookmarks |

## Updating

```bash
docker compose pull
docker compose up -d
```

## Configuration

| Variable | Default | Description |
|---|---|---|
| `HOST` | `0.0.0.0` | Bind address |
| `PORT` | `4321` | Port |
| `DASHBOARD_DATA_DIR` | `/data` | Database directory |

## Build from Source

```bash
git clone https://github.com/kharl26/claude-code
cd claude-code/bootcamp/week-01
docker build -t link-dashboard .
```

Then in `docker-compose.yml`, replace the `image:` line with `image: link-dashboard`.

## Stack

- [Astro](https://astro.build) SSR + Node adapter
- [HTMX](https://htmx.org) — server-driven interactions
- [Alpine.js](https://alpinejs.dev) — UI reactivity
- [SortableJS](https://sortablejs.github.io/Sortable/) — drag-and-drop
- [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) — local SQLite
