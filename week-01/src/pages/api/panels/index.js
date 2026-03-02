import { createPanel, getPanels } from '../../../lib/db.js';
import { renderMain } from '../../../lib/render.js';

export async function POST({ request }) {
  const data = await request.formData();
  const name = data.get('name')?.trim();
  if (!name)             return new Response('Name required', { status: 400 });
  if (name.length > 200) return new Response('Name too long', { status: 400 });

  const result = createPanel(name);
  const panels = getPanels();
  // New panel is active; it has no categories yet.
  return new Response(renderMain(panels, result.lastInsertRowid, []), {
    headers: { 'Content-Type': 'text/html' },
  });
}
