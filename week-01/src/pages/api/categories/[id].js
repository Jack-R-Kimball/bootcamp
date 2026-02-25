import { deleteCategory, getCategories, getPanelIdForCategory } from '../../../lib/db.js';
import { renderCategories } from '../../../lib/render.js';

export async function DELETE({ params, url }) {
  const catId = Number(params.id);
  // Resolve panel_id before deleting so we know which panel to re-render.
  const panelId = getPanelIdForCategory(catId)
                  ?? Number(url.searchParams.get('panel_id'));
  deleteCategory(catId);
  return new Response(renderCategories(getCategories(panelId), panelId), {
    headers: { 'Content-Type': 'text/html' },
  });
}
