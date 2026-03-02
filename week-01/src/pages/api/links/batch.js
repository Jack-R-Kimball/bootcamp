import { createLink } from '../../../lib/db.js';

const VALID_URL = /^https?:\/\//i;

export async function POST({ request }) {
  const { links, category_id } = await request.json();
  if (!Array.isArray(links) || !category_id)
    return new Response('links and category_id required', { status: 400 });

  let imported = 0;
  for (const link of links) {
    if (!link.name || !link.url || !VALID_URL.test(link.url)) continue;
    createLink(
      Number(category_id),
      String(link.name).slice(0, 500),
      String(link.url).slice(0, 2000),
      link.description ? String(link.description).slice(0, 5000) : null,
      link.tags        ? String(link.tags).slice(0, 500)         : null,
      link.keyword     ? String(link.keyword).slice(0, 200)      : null,
    );
    imported++;
  }

  return new Response(JSON.stringify({ imported }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
