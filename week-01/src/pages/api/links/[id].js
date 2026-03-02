import { updateLink, deleteLink, getCategories, getPanelIdForLink } from '../../../lib/db.js';
import { renderCategories } from '../../../lib/render.js';

const VALID_URL = /^https?:\/\//i;
const html = (cats, panelId) =>
  new Response(renderCategories(cats, panelId), { headers: { 'Content-Type': 'text/html' } });

export async function PUT({ request, params }) {
  const linkId = Number(params.id);
  const data = await request.formData();
  const name = data.get('name')?.trim();
  const url  = data.get('url')?.trim();
  if (!name || !url) return new Response('Missing fields', { status: 400 });
  if (!VALID_URL.test(url))  return new Response('URL must start with http:// or https://', { status: 400 });
  if (name.length > 500)     return new Response('Name too long',  { status: 400 });
  if (url.length  > 2000)    return new Response('URL too long',   { status: 400 });

  const description = data.get('description')?.trim() || null;
  const tags        = data.get('tags')?.trim()        || null;
  const keyword     = data.get('keyword')?.trim()     || null;
  if (description && description.length > 5000) return new Response('Description too long', { status: 400 });
  if (tags        && tags.length        > 500)  return new Response('Tags too long',        { status: 400 });
  if (keyword     && keyword.length     > 200)  return new Response('Keyword too long',     { status: 400 });
  // Prefer the panel_id sent by the form; fall back to a DB lookup.
  // > 0 guard: panel IDs are always ≥ 1 (autoincrement), so 0 / NaN must fall back.
  const rawPanelId = Number(data.get('panel_id'));
  const panelId = rawPanelId > 0 ? rawPanelId : getPanelIdForLink(linkId);
  updateLink(linkId, name, url, description, tags, keyword);
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
