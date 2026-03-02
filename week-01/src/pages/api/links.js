import { createLink, getCategories, getPanelIdForCategory } from '../../lib/db.js';
import { renderCategories } from '../../lib/render.js';

const VALID_URL = /^https?:\/\//i;

export async function POST({ request }) {
  const data = await request.formData();
  const category_id = Number(data.get('category_id'));
  const name = data.get('name')?.trim();
  const url  = data.get('url')?.trim();
  if (!category_id || !name || !url) return new Response('Missing fields', { status: 400 });
  if (!VALID_URL.test(url))  return new Response('URL must start with http:// or https://', { status: 400 });
  if (name.length > 500)     return new Response('Name too long',        { status: 400 });
  if (url.length  > 2000)    return new Response('URL too long',         { status: 400 });

  const description = data.get('description')?.trim() || null;
  if (description && description.length > 5000) return new Response('Description too long', { status: 400 });
  // panel_id is sent as a hidden field by the add-link form so we can re-render
  // the correct panel's categories.  Fall back to a DB lookup in case it's absent.
  // Use > 0 rather than || so a hypothetical panel_id="0" never silently uses the
  // fallback (panel IDs are always ≥ 1 from autoincrement).
  const rawPanelId = Number(data.get('panel_id'));
  const panelId = rawPanelId > 0 ? rawPanelId : getPanelIdForCategory(category_id);
  createLink(category_id, name, url, description);
  return new Response(renderCategories(getCategories(panelId), panelId), {
    headers: { 'Content-Type': 'text/html' },
  });
}
