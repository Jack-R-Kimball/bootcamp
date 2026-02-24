import { createCategory, getCategories } from '../../lib/db.js';
import { renderCategories } from '../../lib/render.js';

export async function POST({ request }) {
  const data = await request.formData();
  const name = data.get('name')?.trim();
  if (!name) return new Response('Name required', { status: 400 });

  createCategory(name);
  return new Response(renderCategories(getCategories()), {
    headers: { 'Content-Type': 'text/html' },
  });
}
