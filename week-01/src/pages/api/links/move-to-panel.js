import { moveLinkToPanel } from '../../../lib/db.js';

export async function PUT({ request }) {
  const { link_id, panel_id } = await request.json();
  if (!link_id || !panel_id) return new Response('link_id and panel_id required', { status: 400 });
  const categoryId = moveLinkToPanel(Number(link_id), Number(panel_id));
  if (!categoryId) return new Response('No categories in target panel', { status: 404 });
  return new Response(null, { status: 204 });
}
