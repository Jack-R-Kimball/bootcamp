function esc(v) {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderLink(link, panelId) {
  const metaParts = [];
  if (link.keyword) metaParts.push(`(${esc(link.keyword)})`);
  if (link.tags) metaParts.push(esc(link.tags));
  const metaStr = metaParts.join(' ');
  const statusAttr = link.status ? ` data-status="${esc(link.status)}"` : '';
  return `
    <div class="link-item" id="link-${link.id}" data-id="${link.id}"${statusAttr} x-data="{ menu: false }" @click.outside="menu = false" @mouseleave="menu = false">
      <div class="link-row" @contextmenu.prevent="menu = !menu">
        <span class="drag-handle link-drag-handle" title="Drag to reorder">⠿</span>
        <div class="link-info">
          <a href="${esc(link.url)}" class="link-name" target="_blank" rel="noopener noreferrer">${esc(link.name)}</a>
        </div>
        <span class="link-actions" x-show="menu" x-cloak @mouseleave="menu = false" @click="menu = false">
          <button class="btn-action btn-edit"
            data-link-id="${link.id}"
            data-name="${esc(link.name)}"
            data-url="${esc(link.url)}"
            data-description="${esc(link.description ?? '')}"
            data-tags="${esc(link.tags ?? '')}"
            data-keyword="${esc(link.keyword ?? '')}"
            data-panel-id="${panelId}">edit</button>
          <button class="btn-action del"
            hx-delete="/api/links/${link.id}?panel_id=${panelId}"
            hx-target="#categories"
            hx-swap="innerHTML"
            hx-confirm="Delete '${esc(link.name)}'?">del</button>
        </span>
      </div>
      <div class="link-detail">
        <a href="${esc(link.url)}" class="link-detail-title" target="_blank" rel="noopener noreferrer">${esc(link.name)}</a>
        ${link.description ? `<span class="link-desc">${esc(link.description)}</span>` : ''}
        ${metaStr ? `<span class="link-meta">${metaStr}</span>` : ''}
        <span class="link-detail-url">${esc(link.url)}</span>
      </div>
    </div>`;
}

function renderCategory(cat, panelId) {
  return `
    <div class="category" id="cat-${cat.id}" data-id="${cat.id}"
         x-data="{ renaming: false, menu: false, addingLink: false, collapsed: false, _mobile: false }"
         x-init="collapsed = _mobile = window.matchMedia('(hover: none)').matches"
         :class="{ 'cat-menu-open': menu }">
      <div class="category-header"
           @click="if (_mobile && !renaming) { menu = false; collapsed = !collapsed; if (collapsed) addingLink = false; }">
        <span class="drag-handle cat-drag-handle" title="Drag to reorder">⠿</span>
        <h2 class="category-title" x-show="!renaming">${esc(cat.name)}</h2>
        <form x-show="renaming" x-cloak class="inline-form cat-rename-form"
          hx-put="/api/categories/${cat.id}"
          hx-target="#categories"
          hx-swap="innerHTML"
          @submit="renaming = false">
          <input type="hidden" name="panel_id" value="${panelId}">
          <input name="name" value="${esc(cat.name)}" required x-ref="renameInput">
          <button type="submit" class="btn-primary">save</button>
          <button type="button" class="btn-ghost" @click="renaming = false">cancel</button>
        </form>
        <div class="cat-menu" x-show="!renaming" @click.outside="menu = false">
          <span class="cat-chevron" x-text="collapsed ? '▸' : '▾'"></span>
          <button class="cat-menu-btn" @click.stop="menu = !menu" title="Category options">⋮</button>
          <div class="cat-dropdown" x-show="menu" x-cloak>
            <button class="cat-dd-item"
              @click="renaming = true; menu = false; $nextTick(() => $refs.renameInput.focus())">rename</button>
            <button class="cat-dd-item cat-dd-danger"
              hx-delete="/api/categories/${cat.id}?panel_id=${panelId}"
              hx-target="#categories"
              hx-swap="innerHTML"
              hx-confirm="Delete '${esc(cat.name)}' and all its links?">delete</button>
            <div class="cat-dd-divider"></div>
            <button class="cat-dd-item"
              @click="addingLink = true; menu = false; $nextTick(() => $refs.linkInput.focus())">+ link</button>
          </div>
        </div>
      </div>
      <div class="links-list" x-show="!collapsed">
        ${cat.links.map(l => renderLink(l, panelId)).join('')}
      </div>
      <div class="add-link" x-show="addingLink" x-cloak>
        <form class="inline-form"
          hx-post="/api/links"
          hx-target="#categories"
          hx-swap="innerHTML"
          @submit="addingLink = false">
          <input type="hidden" name="category_id" value="${cat.id}">
          <input type="hidden" name="panel_id" value="${panelId}">
          <input name="name" placeholder="Name" required x-ref="linkInput">
          <input name="url" placeholder="https://" required>
          <input name="description" placeholder="Description (optional)">
          <div class="form-actions">
            <button type="submit" class="btn-primary">save</button>
            <button type="button" class="btn-ghost" @click="addingLink = false">cancel</button>
          </div>
        </form>
      </div>
    </div>`;
}

// ── Tag browser ───────────────────────────────────────────────────────────────

export function renderTagBrowser(tags) {
  if (!tags.length) {
    return '<p class="empty">No tags found.</p>';
  }
  const sections = tags.map(({ tag, links }) => `
    <details class="tag-section">
      <summary class="tag-header">
        <span class="tag-chevron"></span>
        <span class="tag-name">${esc(tag)}</span>
        <span class="tag-count">${links.length}</span>
      </summary>
      <div class="links-list">
        ${links.map(renderSearchLink).join('')}
      </div>
    </details>`).join('');
  return `<div class="tags-wrapper">${sections}</div>`;
}

// ── Search results ─────────────────────────────────────────────────────────────

// Render a single search-result link item (no drag handle, no edit/delete).
function renderSearchLink(r) {
  const metaParts = [];
  if (r.keyword) metaParts.push(`(${esc(r.keyword)})`);
  if (r.tags)    metaParts.push(esc(r.tags));
  const metaStr = metaParts.join(' ');
  return `
    <div class="link-item" data-id="${r.id}">
      <div class="link-row">
        <div class="link-info">
          <a href="${esc(r.url)}" class="link-name" target="_blank" rel="noopener noreferrer">${esc(r.name)}</a>
        </div>
      </div>
      <div class="link-detail">
        <a href="${esc(r.url)}" class="link-detail-title" target="_blank" rel="noopener noreferrer">${esc(r.name)}</a>
        ${r.description ? `<span class="link-desc">${esc(r.description)}</span>` : ''}
        ${metaStr ? `<span class="link-meta">${metaStr}</span>` : ''}
        <span class="link-detail-url">${esc(r.url)}</span>
      </div>
    </div>`;
}

// Render a read-only category card for search results (no Alpine, no controls).
function renderSearchCategory(name, links) {
  return `
    <div class="category">
      <div class="category-header">
        <h2 class="category-title">${esc(name)}</h2>
      </div>
      <div class="links-list">
        ${links.map(renderSearchLink).join('')}
      </div>
    </div>`;
}

// showPanel: true when results span multiple panels so panel headers are shown.
export function renderSearchResults(results, showPanel = false) {
  if (!results.length) {
    return '<p class="empty">No matches found.</p>';
  }

  // Group results: panel → category → links (SQL order preserved)
  const panelOrder = [];
  const panels = new Map();
  for (const r of results) {
    if (!panels.has(r.panel_id)) {
      panels.set(r.panel_id, { name: r.panel_name, catOrder: [], cats: new Map() });
      panelOrder.push(r.panel_id);
    }
    const p = panels.get(r.panel_id);
    if (!p.cats.has(r.cat_id)) {
      p.cats.set(r.cat_id, { name: r.cat_name, links: [] });
      p.catOrder.push(r.cat_id);
    }
    p.cats.get(r.cat_id).links.push(r);
  }

  const sections = panelOrder.map(pid => {
    const panel = panels.get(pid);
    const cats  = panel.catOrder
      .map(cid => renderSearchCategory(panel.cats.get(cid).name, panel.cats.get(cid).links))
      .join('');
    if (showPanel) {
      return `
        <div class="sr-panel-section">
          <div class="sr-panel-header">${esc(panel.name)}</div>
          <div class="sr-cats">${cats}</div>
        </div>`;
    }
    return `<div class="sr-cats">${cats}</div>`;
  }).join('');

  return `<div class="sr-wrapper">${sections}</div>`;
}

export function renderCategories(categories, panelId) {
  if (!categories.length) {
    return '<p class="empty">No categories yet — add one via the ⚙ menu.</p>';
  }
  return categories.map(c => renderCategory(c, panelId)).join('');
}

// ── Panel rendering ───────────────────────────────────────────────────────────

function renderPanelTab(panel, totalPanels) {
  return `
    <div class="panel-tab" data-id="${panel.id}" :class="{ 'panel-tab--active': active === ${panel.id} }">
      <span class="drag-handle panel-drag-grip" title="Drag to reorder">⠿</span>
      <button class="panel-tab__btn"
        hx-get="/api/categories?panel_id=${panel.id}"
        hx-target="#categories"
        hx-swap="innerHTML"
        @click="active = ${panel.id}">
        ${esc(panel.name)}
      </button>
      ${totalPanels > 1 ? `
      <button class="panel-tab__del btn-danger"
        hx-delete="/api/panels/${panel.id}"
        hx-target="#main"
        hx-swap="innerHTML"
        hx-include="[name=panel_id]"
        hx-confirm="Delete panel '${esc(panel.name)}' and all its categories?">&times;</button>
      ` : ''}
    </div>`;
}

function renderPanelBar(panels, activePanelId) {
  return `
    <div class="panel-bar" x-data="{ active: ${activePanelId || 0}, gearOpen: false, addingCat: false, addingPanel: false }">
      <input type="hidden" id="active-panel" name="panel_id" :value="active">
      <div class="panel-gear" @click.outside="gearOpen = false">
        <button class="gear-btn" @click.stop="gearOpen = !gearOpen" :class="{ active: gearOpen }" title="Add category or panel">⚙</button>
        <div class="gear-dropdown" x-show="gearOpen" x-cloak>
          <div x-show="!addingCat && !addingPanel">
            <button class="gear-dd-item" @click="addingCat = true; $nextTick(() => $refs.catName.focus())">+ category</button>
            <button class="gear-dd-item" @click="addingPanel = true; $nextTick(() => $refs.panelName.focus())">+ panel</button>
          </div>
          <form x-show="addingCat" x-cloak class="inline-form gear-form"
            hx-post="/api/categories"
            hx-target="#categories"
            hx-swap="innerHTML"
            hx-include="#active-panel"
            @submit="addingCat = false; gearOpen = false">
            <input x-ref="catName" name="name" placeholder="category name" required>
            <div class="form-actions">
              <button type="submit" class="btn-primary">create</button>
              <button type="button" class="btn-ghost" @click="addingCat = false">cancel</button>
            </div>
          </form>
          <form x-show="addingPanel" x-cloak class="inline-form gear-form"
            hx-post="/api/panels"
            hx-target="#main"
            hx-swap="innerHTML"
            @submit="addingPanel = false; gearOpen = false">
            <input x-ref="panelName" name="name" placeholder="panel name" required>
            <div class="form-actions">
              <button type="submit" class="btn-primary">create</button>
              <button type="button" class="btn-ghost" @click="addingPanel = false">cancel</button>
            </div>
          </form>
        </div>
      </div>
      <div class="panel-tabs">
        ${panels.map(p => renderPanelTab(p, panels.length)).join('')}
      </div>
    </div>`;
}

function renderSelectionBar() {
  return `
    <div id="selection-bar" class="selection-bar" hidden>
      <span id="sel-count" class="sel-count"></span>
      <span class="sel-sep">· move to:</span>
      <select id="sel-panel-dd" class="sel-select"></select>
      <select id="sel-cat-dd"   class="sel-select"></select>
      <button id="sel-move"  class="btn-primary">move</button>
      <button id="sel-clear" class="btn-ghost">✕</button>
    </div>`;
}

export function renderMain(panels, activePanelId, categories) {
  return `
    ${renderPanelBar(panels, activePanelId)}
    ${renderSelectionBar()}
    <div id="categories">
      ${renderCategories(categories, activePanelId)}
    </div>`;
}
