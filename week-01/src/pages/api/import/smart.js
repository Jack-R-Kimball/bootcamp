import { findOrCreatePanel, findOrCreateCategory, createLink } from '../../../lib/db.js';

// Recursively collapse all links from folders at depth >= 3 into catId,
// building a prefix from the sequential letter position of each subfolder.
// folderIndex tracks sibling-folder count separately from links.
function processItems(items, catId, prefix) {
  let added = 0, skipped = 0, folderIndex = 0;
  for (const item of items) {
    if (item.type === 'link') {
      const name = prefix + item.name;
      createLink(catId, name, item.url, item.description || null, item.tags || null, item.keyword || null);
      added++;
    } else if (item.type === 'folder') {
      const letter    = String.fromCharCode(97 + folderIndex); // a, b, c, …
      const subPrefix = prefix + letter + ': ';
      const { added: a, skipped: s } = processItems(item.children, catId, subPrefix);
      added   += a;
      skipped += s;
      folderIndex++;
    }
  }
  return { added, skipped };
}

export async function POST({ request }) {
  let tree;
  try {
    tree = await request.json();
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }
  if (!Array.isArray(tree)) {
    return new Response('Expected array', { status: 400 });
  }

  let panelsCreated = 0, catsCreated = 0, linksAdded = 0, linksSkipped = 0;

  for (const topItem of tree) {
    if (topItem.type !== 'folder') {
      // Top-level links (outside any folder) — skip
      if (topItem.type === 'link') linksSkipped++;
      continue;
    }

    // L1 folder → panel
    const { id: panelId, isNew: newPanel } = findOrCreatePanel(topItem.name);
    if (newPanel) panelsCreated++;

    for (const l2 of topItem.children) {
      if (l2.type === 'folder') {
        // L2 folder → category
        const { id: catId, isNew: newCat } = findOrCreateCategory(l2.name, panelId);
        if (newCat) catsCreated++;

        // L2 direct links — no prefix; L3+ folders get letter prefixes
        const { added, skipped } = processItems(l2.children, catId, '');
        linksAdded   += added;
        linksSkipped += skipped;

      } else if (l2.type === 'link') {
        // Direct link under L1 panel folder — collect into a "Default" category
        const { id: catId, isNew: newCat } = findOrCreateCategory('Default', panelId);
        if (newCat) catsCreated++;
        createLink(catId, l2.name, l2.url, l2.description || null, l2.tags || null, l2.keyword || null);
        linksAdded++;
      }
    }
  }

  return new Response(
    JSON.stringify({ panelsCreated, catsCreated, linksAdded, linksSkipped }),
    { headers: { 'Content-Type': 'application/json' } }
  );
}
