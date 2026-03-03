import { getTagsWithLinks } from '../../lib/db.js';
import { renderTagBrowser } from '../../lib/render.js';

export async function GET() {
  return new Response(renderTagBrowser(getTagsWithLinks()), {
    headers: { 'Content-Type': 'text/html' },
  });
}
