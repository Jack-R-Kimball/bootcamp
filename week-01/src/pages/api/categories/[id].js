import { updateCategory, deleteCategory, getCategories, getPanelIdForCategory } from '../../../lib/db.js';
import { renderCategories } from '../../../lib/render.js';

export async function PUT({ params, request }) {
  const catId = Number(params.id);
  const data  = await request.formData();
  const name  = data.get('name')?.trim();
  if (!name) return new Response('Name required', { status: 400 });

  // Prefer DB lookup (authoritative); fall back to form data if not found.
  // > 0 guard: panel IDs are always ≥ 1 (autoincrement), so 0 / NaN must not be used.
  const rawPanelId = Number(data.get('panel_id'));
  const panelId = getPanelIdForCategory(catId) ?? (rawPanelId > 0 ? rawPanelId : null);
  if (!panelId) return new Response('panel_id missing', { status: 400 });
  updateCategory(catId, name);
  return new Response(renderCategories(getCategories(panelId), panelId), {
    headers: { 'Content-Type': 'text/html' },
  });
}

export async function DELETE({ params, url }) {
  const catId = Number(params.id);
  // Resolve panel_id before deleting (category won't exist after).
  const panelId = getPanelIdForCategory(catId)
                  ?? (Number(url.searchParams.get('panel_id')) || null);
  if (!panelId) return new Response('panel_id missing', { status: 400 });
  deleteCategory(catId);
  return new Response(renderCategories(getCategories(panelId), panelId), {
    headers: { 'Content-Type': 'text/html' },
  });
}
