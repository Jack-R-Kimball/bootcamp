import { bulkMoveLinksToPanel, getCategories } from '../../../lib/db.js';
import { renderCategories } from '../../../lib/render.js';

// Move multiple links to the Default/first category of a target panel in a
// single atomic transaction, avoiding the race condition that could create
// duplicate "Default" categories when N parallel move-to-panel calls are made.
export async function POST({ request }) {
  const { ids, panel_id, source_panel_id } = await request.json();
  if (!Array.isArray(ids) || !ids.length) return new Response('ids required', { status: 400 });
  if (!panel_id)       return new Response('panel_id required', { status: 400 });
  if (!source_panel_id) return new Response('source_panel_id required', { status: 400 });

  bulkMoveLinksToPanel(ids.map(Number), Number(panel_id));
  return new Response(
    renderCategories(getCategories(Number(source_panel_id)), Number(source_panel_id)),
    { headers: { 'Content-Type': 'text/html' } },
  );
}
