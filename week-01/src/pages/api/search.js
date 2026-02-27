import { searchLinks } from '../../lib/db.js';
import { renderSearchResults } from '../../lib/render.js';

export async function GET({ url }) {
  const q = url.searchParams.get('q')?.trim();
  if (!q) return new Response('', { headers: { 'Content-Type': 'text/html' } });

  const panelId      = Number(url.searchParams.get('panel_id')) || null;
  const caseSensitive = url.searchParams.get('cs') === '1';
  const allPanels    = url.searchParams.get('all') === '1';

  const results = searchLinks(q, allPanels ? null : panelId, caseSensitive);
  return new Response(renderSearchResults(results, allPanels || !panelId), {
    headers: { 'Content-Type': 'text/html' },
  });
}
