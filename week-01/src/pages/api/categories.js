import { createCategory, getCategories } from '../../lib/db.js';
import { renderCategories } from '../../lib/render.js';

export async function GET({ url }) {
  const panelId = Number(url.searchParams.get('panel_id'));
  if (!panelId) return new Response('panel_id required', { status: 400 });
  return new Response(renderCategories(getCategories(panelId), panelId), {
    headers: { 'Content-Type': 'text/html' },
  });
}

export async function POST({ request }) {
  const data = await request.formData();
  const name    = data.get('name')?.trim();
  const panelId = Number(data.get('panel_id'));
  if (!name)              return new Response('Name required',    { status: 400 });
  if (name.length > 200)  return new Response('Name too long',    { status: 400 });
  if (!panelId)           return new Response('panel_id required', { status: 400 });

  createCategory(name, panelId);
  return new Response(renderCategories(getCategories(panelId), panelId), {
    headers: { 'Content-Type': 'text/html' },
  });
}
