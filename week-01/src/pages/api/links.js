import { createLink, getCategories } from '../../lib/db.js';
import { renderCategories } from '../../lib/render.js';

export async function POST({ request }) {
  const data = await request.formData();
  const category_id = Number(data.get('category_id'));
  const name = data.get('name')?.trim();
  const url  = data.get('url')?.trim();
  if (!category_id || !name || !url) return new Response('Missing fields', { status: 400 });

  createLink(category_id, name, url);
  return new Response(renderCategories(getCategories()), {
    headers: { 'Content-Type': 'text/html' },
  });
}
