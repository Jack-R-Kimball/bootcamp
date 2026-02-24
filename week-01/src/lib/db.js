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

db.exec(`
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

export function getCategories() {
  const cats  = db.prepare('SELECT * FROM categories ORDER BY id').all();
  const links = db.prepare('SELECT * FROM links ORDER BY id').all();
  return cats.map(c => ({ ...c, links: links.filter(l => l.category_id === c.id) }));
}

export const createCategory = (name) =>
  db.prepare('INSERT INTO categories (name) VALUES (?)').run(name);

export const deleteCategory = (id) =>
  db.prepare('DELETE FROM categories WHERE id = ?').run(id);

export const createLink = (category_id, name, url) =>
  db.prepare('INSERT INTO links (category_id, name, url) VALUES (?, ?, ?)').run(category_id, name, url);

export const updateLink = (id, name, url) =>
  db.prepare('UPDATE links SET name = ?, url = ? WHERE id = ?').run(name, url, id);

export const deleteLink = (id) =>
  db.prepare('DELETE FROM links WHERE id = ?').run(id);
