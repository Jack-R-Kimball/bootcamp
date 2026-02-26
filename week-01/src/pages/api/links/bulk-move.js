import { bulkMoveLinks, getCategories } from '../../../lib/db.js';
import { renderCategories } from '../../../lib/render.js';

export async function POST({ request }) {
  const { ids, category_id, source_panel_id } = await request.json();
  if (!Array.isArray(ids) || !ids.length) return new Response('ids required', { status: 400 });
  if (!category_id)    return new Response('category_id required', { status: 400 });
  if (!source_panel_id) return new Response('source_panel_id required', { status: 400 });

  bulkMoveLinks(ids.map(Number), Number(category_id));
  return new Response(
    renderCategories(getCategories(Number(source_panel_id)), Number(source_panel_id)),
    { headers: { 'Content-Type': 'text/html' } },
  );
}
