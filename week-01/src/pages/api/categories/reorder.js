import { reorderCategories } from '../../../lib/db.js';

export async function PUT({ request }) {
  const { ids } = await request.json();
  if (!Array.isArray(ids)) return new Response('ids required', { status: 400 });
  reorderCategories(ids.map(Number));
  return new Response(null, { status: 204 });
}
