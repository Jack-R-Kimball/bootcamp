import { deleteCategory, getCategories } from '../../../lib/db.js';
import { renderCategories } from '../../../lib/render.js';

export async function DELETE({ params }) {
  deleteCategory(Number(params.id));
  return new Response(renderCategories(getCategories()), {
    headers: { 'Content-Type': 'text/html' },
  });
}
