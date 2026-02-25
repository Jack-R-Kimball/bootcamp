function esc(v) {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderLink(link, panelId) {
  return `
    <div class="link-item" id="link-${link.id}" x-data="{ editing: false }">
      <div x-show="!editing" class="link-row">
        <a href="${esc(link.url)}" class="link-name" target="_blank" rel="noopener noreferrer">${esc(link.name)}</a>
        <span class="link-actions">
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
        <button type="submit" class="btn-primary">save</button>
        <button type="button" class="btn-ghost" @click="editing = false">cancel</button>
      </form>
    </div>`;
}

function renderCategory(cat, panelId) {
  return `
    <div class="category" id="cat-${cat.id}">
      <div class="category-header">
        <h2 class="category-title">${esc(cat.name)}</h2>
        <button class="btn-danger"
          hx-delete="/api/categories/${cat.id}?panel_id=${panelId}"
          hx-target="#categories"
          hx-swap="innerHTML"
          hx-confirm="Delete '${esc(cat.name)}' and all its links?">&times;</button>
      </div>
      <div class="links-list">
        ${cat.links.map(l => renderLink(l, panelId)).join('')}
      </div>
      <div class="add-link" x-data="{ open: false }">
        <button x-show="!open" @click="open = true" class="btn-ghost add-link-btn">+ add link</button>
        <form x-show="open" x-cloak class="inline-form"
          hx-post="/api/links"
          hx-target="#categories"
          hx-swap="innerHTML">
          <input type="hidden" name="category_id" value="${cat.id}">
          <input type="hidden" name="panel_id" value="${panelId}">
          <input name="name" placeholder="Name" required>
          <input name="url" placeholder="https://" required>
          <button type="submit" class="btn-primary">add</button>
          <button type="button" class="btn-ghost" @click="open = false">cancel</button>
        </form>
      </div>
    </div>`;
}

export function renderCategories(categories, panelId) {
  if (!categories.length) {
    return '<p class="empty">No categories yet — create one above.</p>';
  }
  return categories.map(c => renderCategory(c, panelId)).join('');
}

// ── Panel rendering ───────────────────────────────────────────────────────────

function renderPanelTab(panel, isActive, totalPanels) {
  return `
    <div class="panel-tab${isActive ? ' panel-tab--active' : ''}">
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
    <div class="panel-bar" x-data="{ active: ${activePanelId || 0} }">
      <input type="hidden" id="active-panel" :value="active">
      <div class="panel-tabs">
        ${panels.map(p => renderPanelTab(p, p.id === activePanelId, panels.length)).join('')}
      </div>
      <div class="panel-actions" x-data="{ adding: false }">
        <button x-show="!adding" @click="adding = true" class="btn-ghost panel-add-btn">+ panel</button>
        <form x-show="adding" x-cloak class="inline-form"
          hx-post="/api/panels"
          hx-target="#main"
          hx-swap="innerHTML">
          <input name="name" placeholder="panel name" required>
          <button type="submit" class="btn-primary">create</button>
          <button type="button" class="btn-ghost" @click="adding = false">cancel</button>
        </form>
      </div>
    </div>`;
}

function renderActionBar() {
  // Uses hx-include="#active-panel" so it always reads the live Alpine-managed
  // value, even after the user has switched tabs without reloading the action bar.
  return `
    <div class="action-bar" x-data="{ adding: false }">
      <button x-show="!adding" @click="adding = true" class="btn-primary">+ category</button>
      <form x-show="adding" x-cloak class="inline-form"
        hx-post="/api/categories"
        hx-target="#categories"
        hx-swap="innerHTML"
        hx-include="#active-panel">
        <input name="name" placeholder="category name" required>
        <button type="submit" class="btn-primary">create</button>
        <button type="button" class="btn-ghost" @click="adding = false">cancel</button>
      </form>
    </div>`;
}

export function renderMain(panels, activePanelId, categories) {
  return `
    ${renderPanelBar(panels, activePanelId)}
    ${renderActionBar()}
    <div id="categories">
      ${renderCategories(categories, activePanelId)}
    </div>`;
}
