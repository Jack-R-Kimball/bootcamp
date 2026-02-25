import Database from 'better-sqlite3';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '../../../data');
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
try {
  db.exec(`ALTER TABLE categories ADD COLUMN panel_id INTEGER REFERENCES panels(id) ON DELETE CASCADE`);
} catch { /* already exists */ }
try {
  db.exec(`ALTER TABLE categories ADD COLUMN position INTEGER DEFAULT 0`);
} catch { /* already exists */ }
try {
  db.exec(`ALTER TABLE links ADD COLUMN position INTEGER DEFAULT 0`);
} catch { /* already exists */ }

// ── Seed default panel if none exists ─────────────────────────────────────────
const seedDefault = db.transaction(() => {
  const count = db.prepare('SELECT COUNT(*) as n FROM panels').get().n;
  if (count === 0) {
    const result = db.prepare(`INSERT INTO panels (name) VALUES ('Default')`).run();
    db.prepare('UPDATE categories SET panel_id = ? WHERE panel_id IS NULL').run(result.lastInsertRowid);
  }
});
seedDefault();

// ── Panels ────────────────────────────────────────────────────────────────────
export function getPanels() {
  return db.prepare('SELECT * FROM panels ORDER BY id').all();
}

export function createPanel(name) {
  return db.prepare('INSERT INTO panels (name) VALUES (?)').run(name);
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
  return db.prepare('INSERT INTO categories (name, panel_id) VALUES (?, ?)').run(name, panelId);
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

export const createLink = (category_id, name, url) =>
  db.prepare('INSERT INTO links (category_id, name, url) VALUES (?, ?, ?)').run(category_id, name, url);

export const updateLink = (id, name, url) =>
  db.prepare('UPDATE links SET name = ?, url = ? WHERE id = ?').run(name, url, id);

export const deleteLink = (id) =>
  db.prepare('DELETE FROM links WHERE id = ?').run(id);

// ── Cross-panel link move ─────────────────────────────────────────────────────
export function moveLinkToPanel(linkId, panelId) {
  const cat = db.prepare(
    'SELECT id FROM categories WHERE panel_id = ? ORDER BY position, id LIMIT 1'
  ).get(panelId);
  if (!cat) return null;
  const maxPos = db.prepare(
    'SELECT COALESCE(MAX(position), -1) AS m FROM links WHERE category_id = ?'
  ).get(cat.id).m;
  db.prepare('UPDATE links SET category_id = ?, position = ? WHERE id = ?')
    .run(cat.id, maxPos + 1, linkId);
  return cat.id;
}

// ── Reordering ────────────────────────────────────────────────────────────────
export function reorderCategories(ids) {
  const stmt = db.prepare('UPDATE categories SET position = ? WHERE id = ?');
  db.transaction(() => ids.forEach((id, i) => stmt.run(i, id)))();
}

export function reorderLinks(ids, categoryId) {
  const stmt = db.prepare('UPDATE links SET category_id = ?, position = ? WHERE id = ?');
  db.transaction(() => ids.forEach((id, i) => stmt.run(categoryId, i, id)))();
}
