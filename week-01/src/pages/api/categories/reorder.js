import { reorderCategories } from '../../../lib/db.js';

export async function PUT({ request }) {
  const { ids } = await request.json();
  if (!Array.isArray(ids)) return new Response('ids required', { status: 400 });
  try {
    reorderCategories(ids.map(Number));
  } catch (e) {
    return new Response(e.message, { status: 400 });
  }
  return new Response(null, { status: 204 });
}
