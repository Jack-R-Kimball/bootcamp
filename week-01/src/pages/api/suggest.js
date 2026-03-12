import { getSuggestData } from '../../lib/db.js';
import { fetchDescription } from '../../lib/extract.js';

export async function GET({ url }) {
  const targetUrl = url.searchParams.get('url') ?? '';
  const name      = url.searchParams.get('name') ?? '';
  if (!targetUrl) return new Response('Missing url', { status: 400 });

  const { panelId, categoryId, allTags } = getSuggestData(targetUrl);

  // Fetch description server-side (256 KB — enough for body content)
  const description = await fetchDescription(targetUrl, 262144);

  // Suggest tags by matching existing tag names against title + description.
  // Use word-boundary regex instead of substring match so short tags like "OS"
  // or "art" don't fire inside words like "across", "article", "start", etc.
  const searchText = `${name} ${description ?? ''}`;
  const tags = allTags.filter(t => {
    const escaped = t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`\\b${escaped}\\b`, 'i').test(searchText);
  }).join(', ') || null;

  return new Response(JSON.stringify({ description, panel_id: panelId, category_id: categoryId, tags }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
