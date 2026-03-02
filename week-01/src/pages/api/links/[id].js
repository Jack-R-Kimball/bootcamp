import { updateLink, deleteLink, getCategories, getPanelIdForLink } from '../../../lib/db.js';
import { renderCategories } from '../../../lib/render.js';

const html = (cats, panelId) =>
  new Response(renderCategories(cats, panelId), { headers: { 'Content-Type': 'text/html' } });

export async function PUT({ request, params }) {
  const linkId = Number(params.id);
  const data = await request.formData();
  const name = data.get('name')?.trim();
  const url  = data.get('url')?.trim();
  if (!name || !url) return new Response('Missing fields', { status: 400 });

  const description = data.get('description')?.trim() || null;
  // Prefer the panel_id sent by the form; fall back to a DB lookup.
  // > 0 guard: panel IDs are always ≥ 1 (autoincrement), so 0 / NaN must fall back.
  const rawPanelId = Number(data.get('panel_id'));
  const panelId = rawPanelId > 0 ? rawPanelId : getPanelIdForLink(linkId);
  updateLink(linkId, name, url, description);
  return html(getCategories(panelId), panelId);
}

export async function DELETE({ params, url }) {
  const linkId = Number(params.id);
  // Resolve panel_id before deleting (link won't exist after).
  const panelId = getPanelIdForLink(linkId)
                  ?? (Number(url.searchParams.get('panel_id')) || null);
  if (!panelId) return new Response('panel_id missing', { status: 400 });
  deleteLink(linkId);
  return html(getCategories(panelId), panelId);
}
