import { deletePanel, getPanels, getCategories } from '../../../lib/db.js';
import { renderMain } from '../../../lib/render.js';

export async function DELETE({ params, url }) {
  const result = deletePanel(Number(params.id));
  if (!result.changes) return new Response('Panel not found', { status: 404 });

  const panels = getPanels();
  // Stay on the previously-active panel if it still exists; else fall back to first.
  // The active panel id is passed as ?panel_id= via hx-include on the delete button.
  const requestedId   = Number(url.searchParams.get('panel_id')) || 0;
  const activePanelId = panels.find(p => p.id === requestedId)?.id ?? panels[0]?.id;
  const categories    = activePanelId ? getCategories(activePanelId) : [];

  return new Response(renderMain(panels, activePanelId, categories), {
    headers: { 'Content-Type': 'text/html' },
  });
}
