import { findOrCreatePanel, findOrCreateCategory, createLink } from '../../../lib/db.js';

const VALID_URL = /^https?:\/\//i;

// Recursively collapse all links from folders at depth >= 3 into catId,
// building a prefix from the sequential letter position of each subfolder.
// folderIndex tracks sibling-folder count separately from links.
function processItems(items, catId, prefix) {
  let added = 0, skipped = 0, folderIndex = 0;
  for (const item of items) {
    if (item.type === 'link') {
      if (!VALID_URL.test(item.url)) { skipped++; continue; }
      const name = (prefix + item.name).slice(0, 500);
      createLink(catId, name, item.url.slice(0, 2000),
        item.description ? String(item.description).slice(0, 5000) : null,
        item.tags        ? String(item.tags).slice(0, 500)         : null,
        item.keyword     ? String(item.keyword).slice(0, 200)      : null,
      );
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
        if (!VALID_URL.test(l2.url)) { linksSkipped++; continue; }
        // Direct link under L1 panel folder — collect into a "Default" category
        const { id: catId, isNew: newCat } = findOrCreateCategory('Default', panelId);
        if (newCat) catsCreated++;
        createLink(catId, String(l2.name).slice(0, 500), l2.url.slice(0, 2000),
          l2.description ? String(l2.description).slice(0, 5000) : null,
          l2.tags        ? String(l2.tags).slice(0, 500)         : null,
          l2.keyword     ? String(l2.keyword).slice(0, 200)      : null,
        );
        linksAdded++;
      }
    }
  }

  return new Response(
    JSON.stringify({ panelsCreated, catsCreated, linksAdded, linksSkipped }),
    { headers: { 'Content-Type': 'application/json' } }
  );
}
