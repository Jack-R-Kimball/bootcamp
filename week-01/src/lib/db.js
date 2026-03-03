import Database from 'better-sqlite3';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DASHBOARD_DATA_DIR || join(__dirname, '../../../data');
mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(join(DATA_DIR, 'dashboard.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ── Base schema ───────────────────────────────────────────────────────────────
db.exec(`
  CREATE TABLE IF NOT EXISTS panels (
    id   INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS categories (
    id   INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS links (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    url         TEXT NOT NULL
  );
`);

// ── Migrations ────────────────────────────────────────────────────────────────
// Each migration is idempotent: swallow only "duplicate column name" errors so
// real failures (disk full, corruption, syntax errors) still surface.
function migrate(sql) {
  try {
    db.exec(sql);
  } catch (e) {
    if (!e.message?.includes('duplicate column name')) throw e;
  }
}

migrate(`ALTER TABLE panels ADD COLUMN position INTEGER DEFAULT 0`);
migrate(`ALTER TABLE categories ADD COLUMN panel_id INTEGER REFERENCES panels(id) ON DELETE CASCADE`);
migrate(`ALTER TABLE categories ADD COLUMN position INTEGER DEFAULT 0`);
migrate(`ALTER TABLE links ADD COLUMN position INTEGER DEFAULT 0`);
migrate(`ALTER TABLE links ADD COLUMN description TEXT`);
migrate(`ALTER TABLE links ADD COLUMN tags TEXT`);
migrate(`ALTER TABLE links ADD COLUMN keyword TEXT`);
migrate(`ALTER TABLE links ADD COLUMN status TEXT`);

// ── Seed default panel if none exists ─────────────────────────────────────────
const seedDefault = db.transaction(() => {
  const count = db.prepare('SELECT COUNT(*) as n FROM panels').get().n;
  if (count === 0) {
    const result = db.prepare(`INSERT INTO panels (name, position) VALUES ('Default', 0)`).run();
    db.prepare('UPDATE categories SET panel_id = ? WHERE panel_id IS NULL').run(result.lastInsertRowid);
  }
});
seedDefault();

// ── Panels ────────────────────────────────────────────────────────────────────
export function getPanels() {
  return db.prepare('SELECT * FROM panels ORDER BY position, id').all();
}

export function reorderPanels(ids) {
  const stmt = db.prepare('UPDATE panels SET position = ? WHERE id = ?');
  db.transaction(() => ids.forEach((id, i) => stmt.run(i, id)))();
}

export function createPanel(name) {
  const { maxPos } = db.prepare('SELECT COALESCE(MAX(position), -1) AS maxPos FROM panels').get();
  return db.prepare('INSERT INTO panels (name, position) VALUES (?, ?)').run(name, maxPos + 1);
}

export function deletePanel(id) {
  return db.prepare('DELETE FROM panels WHERE id = ?').run(id);
}

// ── Categories (scoped to panel) ──────────────────────────────────────────────
export function getCategories(panelId) {
  const cats = db.prepare('SELECT * FROM categories WHERE panel_id = ? ORDER BY position, id').all(panelId);
  if (!cats.length) return [];
  const links = db.prepare(
    `SELECT * FROM links WHERE category_id IN (${cats.map(() => '?').join(',')}) ORDER BY position, id`
  ).all(cats.map(c => c.id));
  return cats.map(c => ({ ...c, links: links.filter(l => l.category_id === c.id) }));
}

export function createCategory(name, panelId) {
  const { maxPos } = db.prepare(
    'SELECT COALESCE(MAX(position), -1) AS maxPos FROM categories WHERE panel_id = ?'
  ).get(panelId);
  return db.prepare('INSERT INTO categories (name, panel_id, position) VALUES (?, ?, ?)').run(name, panelId, maxPos + 1);
}

export function updateCategory(id, name) {
  return db.prepare('UPDATE categories SET name = ? WHERE id = ?').run(name, id);
}

export function deleteCategory(id) {
  return db.prepare('DELETE FROM categories WHERE id = ?').run(id);
}

export function getPanelIdForCategory(categoryId) {
  return db.prepare('SELECT panel_id FROM categories WHERE id = ?').get(categoryId)?.panel_id ?? null;
}

// ── Links ─────────────────────────────────────────────────────────────────────
export function getPanelIdForLink(linkId) {
  return db.prepare(
    `SELECT c.panel_id FROM links l JOIN categories c ON c.id = l.category_id WHERE l.id = ?`
  ).get(linkId)?.panel_id ?? null;
}

export const createLink = (category_id, name, url, description = null, tags = null, keyword = null) =>
  db.prepare('INSERT INTO links (category_id, name, url, description, tags, keyword) VALUES (?, ?, ?, ?, ?, ?)').run(category_id, name, url, description, tags, keyword);

export const updateLink = (id, name, url, description = null, tags = null, keyword = null) =>
  db.prepare('UPDATE links SET name = ?, url = ?, description = ?, tags = ?, keyword = ? WHERE id = ?').run(name, url, description, tags, keyword, id);

export const deleteLink = (id) =>
  db.prepare('DELETE FROM links WHERE id = ?').run(id);

// Returns links that haven't been checked yet (status IS NULL).
export function getLinksNeedingFetch() {
  return db.prepare(`
    SELECT id, name, url, description FROM links
    WHERE status IS NULL
    ORDER BY id
  `).all();
}

// Returns yellow links for re-check with improved extraction.
export function getYellowLinks() {
  return db.prepare(`
    SELECT id, name, url, description FROM links
    WHERE status = 'yellow'
    ORDER BY id
  `).all();
}

export function updateLinkStatus(id, status, newDescription = null) {
  if (newDescription !== null) {
    db.prepare('UPDATE links SET status = ?, description = ? WHERE id = ?').run(status, newDescription, id);
  } else {
    db.prepare('UPDATE links SET status = ? WHERE id = ?').run(status, id);
  }
}

// ── Tag browser ───────────────────────────────────────────────────────────────
// Returns [{tag, links:[...]}] sorted alphabetically.
// Tags are stored as comma-separated strings; splitting happens in JS.
export function getTagsWithLinks() {
  const links = db.prepare(`
    SELECT l.id, l.name, l.url, l.description, l.keyword, l.tags,
           c.id as cat_id, c.name as cat_name,
           p.id as panel_id, p.name as panel_name
    FROM links l
    JOIN categories c ON c.id = l.category_id
    JOIN panels p ON p.id = c.panel_id
    WHERE l.tags IS NOT NULL AND trim(l.tags) != ''
    ORDER BY p.position, p.id, c.position, c.id, l.position, l.id
  `).all();

  const tagMap = new Map();
  for (const link of links) {
    for (const raw of link.tags.split(',')) {
      const tag = raw.trim();
      if (!tag) continue;
      if (!tagMap.has(tag)) tagMap.set(tag, []);
      tagMap.get(tag).push(link);
    }
  }

  return [...tagMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
    .map(([tag, links]) => ({ tag, links }));
}

// ── Search ────────────────────────────────────────────────────────────────────
export function searchLinks(query, panelId = null, caseSensitive = false) {
  const term = caseSensitive ? query : query.toLowerCase();
  const matchExpr = caseSensitive
    ? `(instr(l.name, ?) > 0 OR instr(l.url, ?) > 0 OR instr(COALESCE(l.description, ''), ?) > 0 OR instr(COALESCE(l.keyword, ''), ?) > 0 OR instr(COALESCE(l.tags, ''), ?) > 0)`
    : `(instr(lower(l.name), ?) > 0 OR instr(lower(l.url), ?) > 0 OR instr(lower(COALESCE(l.description, '')), ?) > 0 OR instr(lower(COALESCE(l.keyword, '')), ?) > 0 OR instr(lower(COALESCE(l.tags, '')), ?) > 0)`;
  const params = [term, term, term, term, term];
  let sql = `
    SELECT l.id, l.name, l.url, l.description, l.keyword, l.tags,
           c.id as cat_id, c.name as cat_name,
           p.id as panel_id, p.name as panel_name
    FROM links l
    JOIN categories c ON c.id = l.category_id
    JOIN panels p ON p.id = c.panel_id
    WHERE ${matchExpr}`;
  if (panelId) { sql += ' AND c.panel_id = ?'; params.push(panelId); }
  sql += ' ORDER BY p.position, p.id, c.position, c.id, l.position, l.id';
  return db.prepare(sql).all(...params);
}

// ── Reordering ────────────────────────────────────────────────────────────────
export function reorderCategories(ids) {
  if (!ids.length) return;
  // Guard against accidental cross-panel mixes (client should never send these,
  // but reject explicitly rather than silently scrambling positions).
  const placeholders = ids.map(() => '?').join(',');
  const panels = db.prepare(
    `SELECT DISTINCT panel_id FROM categories WHERE id IN (${placeholders})`
  ).all(ids);
  if (panels.length > 1) throw new Error('Cannot reorder categories across panels');
  const stmt = db.prepare('UPDATE categories SET position = ? WHERE id = ?');
  db.transaction(() => ids.forEach((id, i) => stmt.run(i, id)))();
}

// Reorder links — sets both category_id and position for each id.
// Handles same-category reorder and cross-category drag in one pass.
export function reorderLinks(ids, categoryId) {
  const cat = db.prepare('SELECT id FROM categories WHERE id = ?').get(categoryId);
  if (!cat) throw new Error(`Category ${categoryId} not found`);
  const stmt = db.prepare('UPDATE links SET category_id = ?, position = ? WHERE id = ?');
  db.transaction(() => ids.forEach((id, i) => stmt.run(categoryId, i, id)))();
}

// Bulk-move links to a different category (possibly on a different panel).
export function bulkMoveLinks(ids, categoryId) {
  const cat = db.prepare('SELECT id FROM categories WHERE id = ?').get(categoryId);
  if (!cat) throw new Error(`Category ${categoryId} not found`);
  const stmt = db.prepare('UPDATE links SET category_id = ? WHERE id = ?');
  db.transaction(() => ids.forEach(id => stmt.run(categoryId, id)))();
}

// ── Suggest helpers (used by /api/suggest) ────────────────────────────────────

// Domain-based panel/category suggestion + full tag list.
export function getSuggestData(url) {
  let panelId = null, categoryId = null;
  try {
    const domain = new URL(url).hostname.replace(/^www\./, '');
    const match  = db.prepare(`
      SELECT c.panel_id, l.category_id, COUNT(*) as n
      FROM links l
      JOIN categories c ON c.id = l.category_id
      WHERE lower(l.url) LIKE ?
      GROUP BY c.panel_id, l.category_id
      ORDER BY n DESC
      LIMIT 1
    `).get(`%${domain}%`);
    if (match) { panelId = match.panel_id; categoryId = match.category_id; }
  } catch { /* invalid URL */ }

  const tagRows = db.prepare(
    `SELECT DISTINCT tags FROM links WHERE tags IS NOT NULL AND trim(tags) != ''`
  ).all();
  const allTags = new Set();
  for (const { tags } of tagRows) {
    for (const t of tags.split(',')) { const tag = t.trim(); if (tag) allTags.add(tag); }
  }

  return { panelId, categoryId, allTags: [...allTags] };
}

// ── Find-or-create helpers (used by smart import) ─────────────────────────────
export function findOrCreatePanel(name) {
  const existing = db.prepare('SELECT id FROM panels WHERE name = ?').get(name);
  if (existing) return { id: existing.id, isNew: false };
  const { maxPos } = db.prepare('SELECT COALESCE(MAX(position), -1) AS maxPos FROM panels').get();
  const r = db.prepare('INSERT INTO panels (name, position) VALUES (?, ?)').run(name, maxPos + 1);
  return { id: r.lastInsertRowid, isNew: true };
}

export function findOrCreateCategory(name, panelId) {
  const existing = db.prepare('SELECT id FROM categories WHERE name = ? AND panel_id = ?').get(name, panelId);
  if (existing) return { id: existing.id, isNew: false };
  const { maxPos } = db.prepare(
    'SELECT COALESCE(MAX(position), -1) AS maxPos FROM categories WHERE panel_id = ?'
  ).get(panelId);
  const r = db.prepare('INSERT INTO categories (name, panel_id, position) VALUES (?, ?, ?)').run(name, panelId, maxPos + 1);
  return { id: r.lastInsertRowid, isNew: true };
}
