// Escape HTML entities in user-provided values
function esc(v) {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderLink(link) {
  return `
    <div class="link-item" id="link-${link.id}" x-data="{ editing: false }">
      <div x-show="!editing" class="link-row">
        <a href="${esc(link.url)}" class="link-name" target="_blank" rel="noopener noreferrer">${esc(link.name)}</a>
        <span class="link-actions">
          <button class="btn-action" @click="editing = true">edit</button>
          <button class="btn-action del"
            hx-delete="/api/links/${link.id}"
            hx-target="#categories"
            hx-swap="innerHTML"
            hx-confirm="Delete '${esc(link.name)}'?">del</button>
        </span>
      </div>
      <form x-show="editing" x-cloak class="inline-form edit-form"
        hx-put="/api/links/${link.id}"
        hx-target="#categories"
        hx-swap="innerHTML">
        <input name="name" value="${esc(link.name)}" required>
        <input name="url" value="${esc(link.url)}" required>
        <button type="submit" class="btn-primary">save</button>
        <button type="button" class="btn-ghost" @click="editing = false">cancel</button>
      </form>
    </div>`;
}

function renderCategory(cat) {
  return `
    <div class="category" id="cat-${cat.id}">
      <div class="category-header">
        <h2 class="category-title">${esc(cat.name)}</h2>
        <button class="btn-danger"
          hx-delete="/api/categories/${cat.id}"
          hx-target="#categories"
          hx-swap="innerHTML"
          hx-confirm="Delete '${esc(cat.name)}' and all its links?">&times;</button>
      </div>
      <div class="links-list">
        ${cat.links.map(renderLink).join('')}
      </div>
      <div class="add-link" x-data="{ open: false }">
        <button x-show="!open" @click="open = true" class="btn-ghost add-link-btn">+ add link</button>
        <form x-show="open" x-cloak class="inline-form"
          hx-post="/api/links"
          hx-target="#categories"
          hx-swap="innerHTML">
          <input type="hidden" name="category_id" value="${cat.id}">
          <input name="name" placeholder="Name" required>
          <input name="url" placeholder="https://" required>
          <button type="submit" class="btn-primary">add</button>
          <button type="button" class="btn-ghost" @click="open = false">cancel</button>
        </form>
      </div>
    </div>`;
}

export function renderCategories(categories) {
  if (!categories.length) {
    return '<p class="empty">No categories yet — create one above.</p>';
  }
  return categories.map(renderCategory).join('');
}
