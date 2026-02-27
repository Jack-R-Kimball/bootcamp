function esc(v) {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderLink(link, panelId) {
  return `
    <div class="link-item" id="link-${link.id}" data-id="${link.id}" x-data="{ editing: false, menu: false }" @click.outside="menu = false">
      <div x-show="!editing" class="link-row" @contextmenu.prevent="menu = !menu">
        <span class="drag-handle link-drag-handle" title="Drag to reorder">⠿</span>
        <div class="link-info">
          <a href="${esc(link.url)}" class="link-name" target="_blank" rel="noopener noreferrer">${esc(link.name)}</a>
          <span class="link-url">${esc(link.url)}</span>
          ${link.description ? `<span class="link-desc">${esc(link.description)}</span>` : ''}
        </div>
        <span class="link-actions" x-show="menu" x-cloak @mouseleave="menu = false" @click="menu = false">
          <button class="btn-action" @click="editing = true">edit</button>
          <button class="btn-action del"
            hx-delete="/api/links/${link.id}?panel_id=${panelId}"
            hx-target="#categories"
            hx-swap="innerHTML"
            hx-confirm="Delete '${esc(link.name)}'?">del</button>
        </span>
      </div>
      <form x-show="editing" x-cloak class="inline-form edit-form"
        hx-put="/api/links/${link.id}"
        hx-target="#categories"
        hx-swap="innerHTML">
        <input type="hidden" name="panel_id" value="${panelId}">
        <input name="name" value="${esc(link.name)}" required>
        <input name="url" value="${esc(link.url)}" required>
        <input name="description" value="${esc(link.description ?? '')}" placeholder="Description (optional)">
        <button type="submit" class="btn-primary">save</button>
        <button type="button" class="btn-ghost" @click="editing = false">cancel</button>
      </form>
    </div>`;
}

function renderCategory(cat, panelId) {
  return `
    <div class="category" id="cat-${cat.id}" data-id="${cat.id}"
         x-data="{ renaming: false, menu: false, addingLink: false }"
         :class="{ 'cat-menu-open': menu }"
         @click.outside="menu = false">
      <div class="category-header">
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
        <div class="cat-menu" x-show="!renaming">
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
      <div class="links-list">
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
          <button type="submit" class="btn-primary">+ link</button>
          <button type="button" class="btn-ghost" @click="addingLink = false">cancel</button>
        </form>
      </div>
    </div>`;
}

export function renderSearchResults(results, showPanel = false) {
  if (!results.length) {
    return '<div class="sr-wrapper"><p class="empty">No matches found.</p></div>';
  }
  const items = results.map(r => `
    <div class="link-item sr-item">
      <div class="link-row">
        <div class="link-info">
          <a href="${esc(r.url)}" class="link-name" target="_blank" rel="noopener noreferrer">${esc(r.name)}</a>
          <span class="sr-loc">${showPanel ? esc(r.panel_name) + ' › ' : ''}${esc(r.cat_name)}</span>
          <span class="link-url">${esc(r.url)}</span>
          ${r.description ? `<span class="link-desc">${esc(r.description)}</span>` : ''}
        </div>
      </div>
    </div>`).join('');
  return `<div class="sr-wrapper">${items}</div>`;
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
        hx-confirm="Delete panel '${esc(panel.name)}' and all its categories?">&times;</button>
      ` : ''}
    </div>`;
}

function renderPanelBar(panels, activePanelId) {
  return `
    <div class="panel-bar" x-data="{ active: ${activePanelId || 0}, gearOpen: false, addingCat: false, addingPanel: false }" @click.outside="gearOpen = false">
      <input type="hidden" id="active-panel" name="panel_id" :value="active">
      <div class="panel-gear">
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
            <button type="submit" class="btn-primary">create</button>
            <button type="button" class="btn-ghost" @click="addingCat = false">cancel</button>
          </form>
          <form x-show="addingPanel" x-cloak class="inline-form gear-form"
            hx-post="/api/panels"
            hx-target="#main"
            hx-swap="innerHTML"
            @submit="addingPanel = false; gearOpen = false">
            <input x-ref="panelName" name="name" placeholder="panel name" required>
            <button type="submit" class="btn-primary">create</button>
            <button type="button" class="btn-ghost" @click="addingPanel = false">cancel</button>
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
      <span class="sel-sep">selected · Move to:</span>
      <select id="sel-panel-dd"></select>
      <select id="sel-cat-dd"></select>
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
