const ICONS = {
  clock: '<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>',
  close: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>',
  edit: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>',
  reset: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path></svg>',
  trash: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>',
};

document.addEventListener('DOMContentLoaded', async () => {
  // Elements
  const showTimerToggle = document.getElementById('showTimerToggle');
  const addCategoryForm = document.getElementById('addCategoryForm');
  const addWebsiteForm = document.getElementById('addWebsiteForm');
  const addStandaloneForm = document.getElementById('addStandaloneForm');

  const categorySelect = document.getElementById('websiteCategorySelect');
  const categoriesList = document.getElementById('categoriesList');
  const standaloneList = document.getElementById('standaloneList');
  const themeSelect = document.getElementById('themeSelect');

  // State
  let config = { categories: {}, standalone: {}, showTimer: true, theme: 'auto', tracking: null };

  // Initialize
  async function loadConfig() {
    const data = await StorageAPI.get(['categories', 'standalone', 'showTimer', 'theme', 'tracking']);
    if (data.categories) config.categories = data.categories;
    if (data.standalone) config.standalone = data.standalone;
    if (data.showTimer !== undefined) config.showTimer = data.showTimer;
    if (data.theme) config.theme = data.theme;
    config.tracking = data.tracking || { spent: {} };

    showTimerToggle.checked = config.showTimer;
    themeSelect.value = config.theme;
    document.documentElement.setAttribute('data-theme', config.theme);
    renderUI();
  }

  async function saveConfig() {
    await StorageAPI.set({
      categories: config.categories,
      standalone: config.standalone,
      showTimer: config.showTimer,
      theme: config.theme
    });
    sendMessage(MSG.CONFIG_UPDATED);
    renderUI();
  }

  // --- Rendering functions ---

  function updateCategorySelect() {
    categorySelect.innerHTML = '<option value="" disabled selected>Select Category...</option>';
    const catNames = Object.keys(config.categories).sort();
    for (const name of catNames) {
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      categorySelect.appendChild(opt);
    }
  }

  function renderCategoriesList() {
    categoriesList.innerHTML = '';
    const catNames = Object.keys(config.categories).sort();
    if (catNames.length === 0) {
      categoriesList.innerHTML = '<div class="empty-state">No categories created yet. Create one to start adding websites.</div>';
      return;
    }

    catNames.forEach(name => {
      const cat = config.categories[name];
      const spentMs = config.tracking.spent[`c:${name}`] || 0;
      const { remainMin } = getRemainingTime(cat.limit, spentMs);
      const statusColor = remainMin === 0 ? 'var(--error-color)' : 'var(--success-color)';

      const item = document.createElement('div');
      item.className = 'category-item';

      const sitesHtml = (cat.sites || []).map((site, idx) => `
        <div class="site-item">
          <div class="site-domain">
             <span class="status-icon cat-status-icon" data-category="${name}" style="color: ${statusColor}">${ICONS.clock}</span>
             ${site}
          </div>
          <button type="button" class="btn icon-only" data-action="remove-site" data-category="${name}" data-index="${idx}" title="Remove website">
            ${ICONS.close}
          </button>
        </div>
      `).join('');

      item.innerHTML = `
        <div class="category-header">
          <div class="category-title">
            ${name}
          </div>
          <div class="category-actions">
            <div class="limit-display">
              <span class="cat-remain-time" data-category="${name}" style="font-weight:600; color:${statusColor}; margin-right:8px;">${remainMin} min left</span>
              <input type="number" class="limit-min" data-action="change-limit" data-category="${name}" value="${cat.limit}" min="1" max="1440">
              <span>min limit</span>
            </div>
            <button type="button" class="btn icon-only" data-action="rename-cat" data-category="${name}" title="Rename category">
              ${ICONS.edit}
            </button>
            <button type="button" class="btn icon-only" data-action="reset-cat" data-category="${name}" title="Reset daily limit">
              ${ICONS.reset}
            </button>
            <button type="button" class="btn icon-only" data-action="remove-cat" data-category="${name}" title="Delete category">
              ${ICONS.trash}
            </button>
          </div>
        </div>
        <div class="sites-list">
          ${sitesHtml || '<div style="color:var(--text-secondary);font-style:italic;font-size:13px;">No websites added yet.</div>'}
        </div>
      `;
      categoriesList.appendChild(item);
    });
  }

  function renderStandaloneList() {
    standaloneList.innerHTML = '';
    const stNames = Object.keys(config.standalone).sort();
    if (stNames.length === 0) {
      standaloneList.innerHTML = '<div class="empty-state">No individual websites created yet.</div>';
      return;
    }

    stNames.forEach(domain => {
      const itemObj = config.standalone[domain];
      const spentMs = config.tracking.spent[`s:${domain}`] || 0;
      const { remainMin } = getRemainingTime(itemObj.limit, spentMs);
      const statusColor = remainMin === 0 ? 'var(--error-color)' : 'var(--success-color)';

      const item = document.createElement('div');
      item.className = 'category-item';
      item.innerHTML = `
        <div class="category-header">
          <div class="category-title">
            <span class="status-icon st-status-icon" data-domain="${domain}" style="color: ${statusColor}">${ICONS.clock}</span>
            ${domain}
          </div>
          <div class="category-actions">
            <div class="limit-display">
              <span class="st-remain-time" data-domain="${domain}" style="font-weight:600; color:${statusColor}; margin-right:8px;">${remainMin} min left</span>
              <input type="number" class="limit-min" data-action="change-limit-st" data-domain="${domain}" value="${itemObj.limit}" min="1" max="1440">
              <span>min limit</span>
            </div>
            <button type="button" class="btn icon-only" data-action="reset-st" data-domain="${domain}" title="Reset daily limit">
              ${ICONS.reset}
            </button>
            <button type="button" class="btn icon-only" data-action="remove-st" data-domain="${domain}" title="Delete individual website">
              ${ICONS.trash}
            </button>
          </div>
        </div>
      `;
      standaloneList.appendChild(item);
    });
  }

  function renderUI() {
    updateCategorySelect();
    renderCategoriesList();
    renderStandaloneList();
  }

  // --- Event delegation (set up once) ---

  categoriesList.addEventListener('click', (e) => {
    const actionEl = e.target.closest('[data-action]');
    if (!actionEl) return;
    const action = actionEl.dataset.action;
    const catName = actionEl.dataset.category;

    if (action === 'rename-cat') {
      const newName = prompt(`Rename category "${catName}" to:`, catName);
      if (newName && newName.trim() && newName.trim() !== catName) {
        const name = newName.trim();
        if (!config.categories[catName]) return alert('Original category not found!');
        if (config.categories[name]) return alert('A category with that name already exists!');
        sendMessage(MSG.RENAME_CATEGORY, { oldName: catName, newName: name }).then(response => {
          if (response?.success) loadConfig();
        });
      }
    } else if (action === 'remove-cat') {
      if (confirm(`Are you sure you want to delete the category "${catName}"?`)) {
        delete config.categories[catName];
        sendMessage(MSG.REMOVE_TARGET, { target: `c:${catName}` }).then(() => saveConfig());
      }
    } else if (action === 'reset-cat') {
      if (confirm(`Are you sure you want to reset the daily limit for the category "${catName}"?`)) {
        sendMessage(MSG.RESET_TRACKING, { target: `c:${catName}` }).then(response => {
          if (response?.success) softRefresh();
        });
      }
    } else if (action === 'remove-site') {
      const index = Number.parseInt(actionEl.dataset.index, 10);
      config.categories[catName].sites.splice(index, 1);
      saveConfig();
    }
  });

  categoriesList.addEventListener('change', (e) => {
    const actionEl = e.target.closest('[data-action="change-limit"]');
    if (!actionEl) return;
    const catName = actionEl.dataset.category;
    const newLimit = Number.parseInt(e.target.value, 10);
    if (newLimit >= 1 && newLimit <= 1440) {
      config.categories[catName].limit = newLimit;
      saveConfig();
    }
  });

  standaloneList.addEventListener('click', (e) => {
    const actionEl = e.target.closest('[data-action]');
    if (!actionEl) return;
    const action = actionEl.dataset.action;
    const domain = actionEl.dataset.domain;

    if (action === 'remove-st') {
      if (confirm(`Are you sure you want to delete "${domain}"?`)) {
        delete config.standalone[domain];
        sendMessage(MSG.REMOVE_TARGET, { target: `s:${domain}` }).then(() => saveConfig());
      }
    } else if (action === 'reset-st') {
      if (confirm(`Are you sure you want to reset the daily limit for "${domain}"?`)) {
        sendMessage(MSG.RESET_TRACKING, { target: `s:${domain}` }).then(response => {
          if (response?.success) softRefresh();
        });
      }
    }
  });

  standaloneList.addEventListener('change', (e) => {
    const actionEl = e.target.closest('[data-action="change-limit-st"]');
    if (!actionEl) return;
    const domain = actionEl.dataset.domain;
    const newLimit = Number.parseInt(e.target.value, 10);
    if (newLimit >= 1 && newLimit <= 1440) {
      config.standalone[domain].limit = newLimit;
      saveConfig();
    }
  });

  // --- Form Submit Handlers ---

  addCategoryForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const nameInput = document.getElementById('newCategoryName');
    const limitInput = document.getElementById('newCategoryLimit');
    const name = nameInput.value.trim();
    const limit = Number.parseInt(limitInput.value, 10);

    if (name && limit > 0) {
      if (!config.categories[name]) {
        config.categories[name] = { limit: limit, sites: [] };
        nameInput.value = '';
        limitInput.value = '';
        saveConfig();
      } else {
        alert('Category already exists!');
      }
    }
  });

  addWebsiteForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const catName = categorySelect.value;
    const domainInput = document.getElementById('newWebsiteDomain');
    let domain = domainInput.value.trim().toLowerCase();

    if (catName && domain) {
      domain = getBaseDomain(domain.includes('http') ? domain : `http://${domain}`);
      if (!domain) return alert('Invalid domain name.');

      const cat = config.categories[catName];
      if (!cat.sites) cat.sites = [];

      if (!cat.sites.includes(domain)) {
        cat.sites.push(domain);
        domainInput.value = '';
        saveConfig();
      } else {
        alert('Website already in this category.');
      }
    }
  });

  addStandaloneForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const domainInput = document.getElementById('newStandaloneDomain');
    const limitInput = document.getElementById('newStandaloneLimit');
    let domain = domainInput.value.trim().toLowerCase();
    const limit = Number.parseInt(limitInput.value, 10);

    if (domain && limit > 0) {
      domain = getBaseDomain(domain.includes('http') ? domain : `http://${domain}`);
      if (!domain) return alert('Invalid domain name.');

      if (!config.standalone[domain]) {
        config.standalone[domain] = { limit: limit };
        domainInput.value = '';
        limitInput.value = '';
        saveConfig();
      } else {
        alert('Individual website already exists.');
      }
    }
  });

  showTimerToggle.addEventListener('change', (e) => {
    config.showTimer = e.target.checked;
    saveConfig();
  });

  themeSelect.addEventListener('change', (e) => {
    config.theme = e.target.value;
    document.documentElement.setAttribute('data-theme', config.theme);
    saveConfig();
  });

  // --- Soft refresh (periodic time updates) ---

  function updateTargetElements(prefix, dataAttr, configMap) {
    const trackingPrefix = prefix === 'cat' ? 'c' : 's';
    document.querySelectorAll(`.${prefix}-remain-time`).forEach(span => {
      const key = span.dataset[dataAttr];
      const obj = configMap[key];
      if (obj) {
        const spentMs = config.tracking.spent[`${trackingPrefix}:${key}`] || 0;
        const { remainMin } = getRemainingTime(obj.limit, spentMs);
        span.textContent = `${remainMin} min left`;
        span.style.color = remainMin === 0 ? 'var(--error-color)' : 'var(--success-color)';
      }
    });
    document.querySelectorAll(`.${prefix}-status-icon`).forEach(icon => {
      const key = icon.dataset[dataAttr];
      const obj = configMap[key];
      if (obj) {
        const spentMs = config.tracking.spent[`${trackingPrefix}:${key}`] || 0;
        const { remainMin } = getRemainingTime(obj.limit, spentMs);
        icon.style.color = remainMin === 0 ? 'var(--error-color)' : 'var(--success-color)';
      }
    });
  }

  function softRefresh() {
    sendMessage(MSG.GET_TRACKING_DATA).then(tracking => {
      if (!tracking) return;
      config.tracking = tracking;
      updateTargetElements('cat', 'category', config.categories);
      updateTargetElements('st', 'domain', config.standalone);
    });
  }

  loadConfig();
  setInterval(softRefresh, 10000);
});
