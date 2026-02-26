import { moveCategoryToPanel, getCategories } from '../../../lib/db.js';
import { renderCategories } from '../../../lib/render.js';

export async function PUT({ request }) {
  const { category_id, panel_id, source_panel_id } = await request.json();
  if (!category_id)    return new Response('category_id required', { status: 400 });
  if (!panel_id)       return new Response('panel_id required', { status: 400 });
  if (!source_panel_id) return new Response('source_panel_id required', { status: 400 });

  moveCategoryToPanel(Number(category_id), Number(panel_id));
  return new Response(
    renderCategories(getCategories(Number(source_panel_id)), Number(source_panel_id)),
    { headers: { 'Content-Type': 'text/html' } },
  );
}
