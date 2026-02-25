import { deletePanel, getPanels, getCategories } from '../../../lib/db.js';
import { renderMain } from '../../../lib/render.js';

export async function DELETE({ params }) {
  deletePanel(Number(params.id));

  const panels = getPanels();
  const activePanelId = panels[0]?.id;
  const categories = activePanelId ? getCategories(activePanelId) : [];

  return new Response(renderMain(panels, activePanelId, categories), {
    headers: { 'Content-Type': 'text/html' },
  });
}
