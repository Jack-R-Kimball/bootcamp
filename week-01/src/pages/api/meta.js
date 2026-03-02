import { getPanels, getCategories } from '../../lib/db.js';

// Returns all panels with their categories — used by the selection bar dropdowns.
export async function GET() {
  const panels = getPanels();
  const data = panels.map(p => ({
    id:   p.id,
    name: p.name,
    cats: getCategories(p.id).map(c => ({ id: c.id, name: c.name })),
  }));
  return new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json' },
  });
}
