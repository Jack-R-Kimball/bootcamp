import { updateCategory, deleteCategory, getCategories, getPanelIdForCategory } from '../../../lib/db.js';
import { renderCategories } from '../../../lib/render.js';

export async function PUT({ params, request }) {
  const catId = Number(params.id);
  const data  = await request.formData();
  const name  = data.get('name')?.trim();
  if (!name) return new Response('Name required', { status: 400 });

  const panelId = getPanelIdForCategory(catId) ?? Number(data.get('panel_id'));
  updateCategory(catId, name);
  return new Response(renderCategories(getCategories(panelId), panelId), {
    headers: { 'Content-Type': 'text/html' },
  });
}

export async function DELETE({ params, url }) {
  const catId = Number(params.id);
  const panelId = getPanelIdForCategory(catId)
                  ?? Number(url.searchParams.get('panel_id'));
  deleteCategory(catId);
  return new Response(renderCategories(getCategories(panelId), panelId), {
    headers: { 'Content-Type': 'text/html' },
  });
}
