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
  const panelId = Number(data.get('panel_id')) || getPanelIdForLink(linkId);
  updateLink(linkId, name, url, description);
  return html(getCategories(panelId), panelId);
}

export async function DELETE({ params, url }) {
  const linkId = Number(params.id);
  // Resolve panel_id before deleting.
  const panelId = getPanelIdForLink(linkId)
                  ?? Number(url.searchParams.get('panel_id'));
  deleteLink(linkId);
  return html(getCategories(panelId), panelId);
}
