import { bulkMoveLinks, getCategories } from '../../../lib/db.js';
import { renderCategories } from '../../../lib/render.js';

export async function POST({ request }) {
  const { ids, category_id, source_panel_id } = await request.json();
  if (!Array.isArray(ids) || !ids.length || !category_id || !source_panel_id)
    return new Response('ids, category_id, and source_panel_id required', { status: 400 });
  try {
    bulkMoveLinks(ids.map(Number), Number(category_id));
  } catch (e) {
    return new Response(e.message, { status: 400 });
  }
  return new Response(renderCategories(getCategories(Number(source_panel_id)), source_panel_id), {
    headers: { 'Content-Type': 'text/html' },
  });
}
