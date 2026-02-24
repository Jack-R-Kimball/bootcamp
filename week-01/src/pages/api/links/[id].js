import { updateLink, deleteLink, getCategories } from '../../../lib/db.js';
import { renderCategories } from '../../../lib/render.js';

const html = (cats) =>
  new Response(renderCategories(cats), { headers: { 'Content-Type': 'text/html' } });

export async function PUT({ request, params }) {
  const data = await request.formData();
  const name = data.get('name')?.trim();
  const url  = data.get('url')?.trim();
  if (!name || !url) return new Response('Missing fields', { status: 400 });

  updateLink(Number(params.id), name, url);
  return html(getCategories());
}

export async function DELETE({ params }) {
  deleteLink(Number(params.id));
  return html(getCategories());
}
