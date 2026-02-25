import { reorderLinks } from '../../../lib/db.js';

export async function PUT({ request }) {
  const { ids, category_id } = await request.json();
  if (!Array.isArray(ids) || !category_id) return new Response('ids and category_id required', { status: 400 });
  reorderLinks(ids.map(Number), Number(category_id));
  return new Response(null, { status: 204 });
}
