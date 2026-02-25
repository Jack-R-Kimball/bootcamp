import { createLink } from '../../../lib/db.js';

export async function POST({ request }) {
  const { links, category_id } = await request.json();
  if (!Array.isArray(links) || !category_id)
    return new Response('links and category_id required', { status: 400 });

  let imported = 0;
  for (const link of links) {
    if (link.name && link.url) {
      createLink(Number(category_id), link.name, link.url, link.description || null);
      imported++;
    }
  }

  return new Response(JSON.stringify({ imported }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
