import { getSuggestData } from '../../lib/db.js';
import { fetchDescription } from '../../lib/extract.js';

export async function GET({ url }) {
  const targetUrl = url.searchParams.get('url') ?? '';
  const name      = url.searchParams.get('name') ?? '';
  if (!targetUrl) return new Response('Missing url', { status: 400 });

  const { panelId, categoryId, allTags } = getSuggestData(targetUrl);

  // Fetch description server-side (256 KB — enough for body content)
  const description = await fetchDescription(targetUrl, 262144);

  // Suggest tags by matching existing tag names against title + description
  const searchText = `${name} ${description ?? ''}`.toLowerCase();
  const tags = allTags.filter(t => searchText.includes(t.toLowerCase())).join(', ') || null;

  return new Response(JSON.stringify({ description, panel_id: panelId, category_id: categoryId, tags }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
