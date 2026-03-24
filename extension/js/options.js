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
    // Request background to reload config, we don't re-render right here 
    // to avoid layout shifts because background updates tracking silently
    chrome.runtime.sendMessage({ type: 'CONFIG_UPDATED' });
    renderUI();
  }

  function renderUI() {
    // 1. Update Select dropdown
    categorySelect.innerHTML = '<option value="" disabled selected>Select Category...</option>';
    const catNames = Object.keys(config.categories).sort();
    for (const name of catNames) {
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      categorySelect.appendChild(opt);
    }

    // 2. Render Categories List
    categoriesList.innerHTML = '';
    if (catNames.length === 0) {
      categoriesList.innerHTML = '<div class="empty-state">No categories created yet. Create one to start adding websites.</div>';
    } else {
      catNames.forEach(name => {
        const cat = config.categories[name];
        const spentMs = config.tracking.spent[`c:${name}`] || 0;
        const limitMs = (cat.limit || 0) * 60 * 1000;
        const remainMs = Math.max(0, limitMs - spentMs);
        const remainMin = Math.ceil(remainMs / 60000);

        const item = document.createElement('div');
        item.className = 'category-item';

        const sitesHtml = (cat.sites || []).map((site, idx) => `
          <div class="site-item">
            <div class="site-domain">
               <svg class="status-icon cat-status-icon" data-category="${name}" style="color: ${remainMin === 0 ? 'var(--error-color)' : 'var(--success-color)'}" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
               ${site}
            </div>
            <button type="button" class="btn icon-only remove-site-btn" data-category="${name}" data-index="${idx}" title="Remove website">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
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
                <span class="cat-remain-time" data-category="${name}" style="font-weight:600; color:${remainMin === 0 ? 'var(--error-color)' : 'var(--success-color)'}; margin-right:8px;">${remainMin} min left</span>
                <input type="number" class="limit-input limit-min" data-category="${name}" value="${cat.limit}" min="1" max="1440">
                <span>min limit</span>
              </div>
              <button type="button" class="btn icon-only rename-cat-btn" data-category="${name}" title="Rename category">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
              </button>
              <button type="button" class="btn icon-only reset-cat-btn" data-category="${name}" title="Reset daily limit">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path></svg>
              </button>
              <button type="button" class="btn icon-only remove-cat-btn" data-category="${name}" title="Delete category">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
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

    // 3. Render Standalone List
    standaloneList.innerHTML = '';
    const stNames = Object.keys(config.standalone).sort();
    if (stNames.length === 0) {
      standaloneList.innerHTML = '<div class="empty-state">No individual websites created yet.</div>';
    } else {
      stNames.forEach(domain => {
        const itemObj = config.standalone[domain];
        const spentMs = config.tracking.spent[`s:${domain}`] || 0;
        const limitMs = (itemObj.limit || 0) * 60 * 1000;
        const remainMs = Math.max(0, limitMs - spentMs);
        const remainMin = Math.ceil(remainMs / 60000);

        const item = document.createElement('div');
        item.className = 'category-item';
        item.innerHTML = `
          <div class="category-header">
            <div class="category-title">
              <svg class="status-icon st-status-icon" data-domain="${domain}" style="color: ${remainMin === 0 ? 'var(--error-color)' : 'var(--success-color)'}" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
              ${domain}
            </div>
            <div class="category-actions">
              <div class="limit-display">
                <span class="st-remain-time" data-domain="${domain}" style="font-weight:600; color:${remainMin === 0 ? 'var(--error-color)' : 'var(--success-color)'}; margin-right:8px;">${remainMin} min left</span>
                <input type="number" class="limit-input-st limit-min" data-domain="${domain}" value="${itemObj.limit}" min="1" max="1440">
                <span>min limit</span>
              </div>
              <button type="button" class="btn icon-only reset-st-btn" data-domain="${domain}" title="Reset daily limit">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path></svg>
              </button>
              <button type="button" class="btn icon-only remove-st-btn" data-domain="${domain}" title="Delete individual website">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
              </button>
            </div>
          </div>
        `;
        standaloneList.appendChild(item);
      });
    }

    // Attach event listeners for dynamic buttons - Categories
    document.querySelectorAll('.rename-cat-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const oldName = e.currentTarget.dataset.category;
        const newName = prompt(`Rename category "${oldName}" to:`, oldName);
        if (newName && newName.trim() && newName.trim() !== oldName) {
          const name = newName.trim();
          if (!config.categories[oldName]) {
            alert('Original category not found!');
            return;
          }
          if (config.categories[name]) {
            alert('A category with that name already exists!');
            return;
          }
          
          chrome.runtime.sendMessage({ type: 'RENAME_CATEGORY', oldName: oldName, newName: name }, (response) => {
             if (response && response.success) {
               loadConfig();
             }
          });
        }
      });
    });

    document.querySelectorAll('.remove-cat-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const catName = e.currentTarget.dataset.category;
        if (confirm(`Are you sure you want to delete the category "${catName}"?`)) {
          delete config.categories[catName];
          chrome.runtime.sendMessage({ type: 'REMOVE_TARGET', target: `c:${catName}` }, () => {
            saveConfig();
          });
        }
      });
    });

    document.querySelectorAll('.reset-cat-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const catName = e.currentTarget.dataset.category;
        if (confirm(`Are you sure you want to reset the daily limit for the category "${catName}"?`)) {
          chrome.runtime.sendMessage({ type: 'RESET_TRACKING', target: `c:${catName}` }, (response) => {
             if (response && response.success) {
               softRefresh();
             }
          });
        }
      });
    });

    document.querySelectorAll('.remove-site-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const catName = e.currentTarget.dataset.category;
        const index = parseInt(e.currentTarget.dataset.index, 10);
        config.categories[catName].sites.splice(index, 1);
        saveConfig();
      });
    });

    document.querySelectorAll('.limit-input').forEach(input => {
      input.addEventListener('change', (e) => {
        const catName = e.currentTarget.dataset.category;
        const newLimit = parseInt(e.target.value, 10);
        if (newLimit >= 1 && newLimit <= 1440) {
          config.categories[catName].limit = newLimit;
          saveConfig();
        }
      });
    });

    // Attach event listeners for dynamic buttons - Standalone
    document.querySelectorAll('.remove-st-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const domain = e.currentTarget.dataset.domain;
        if (confirm(`Are you sure you want to delete "${domain}"?`)) {
          delete config.standalone[domain];
          chrome.runtime.sendMessage({ type: 'REMOVE_TARGET', target: `s:${domain}` }, () => {
             saveConfig();
          });
        }
      });
    });

    document.querySelectorAll('.reset-st-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const domain = e.currentTarget.dataset.domain;
        if (confirm(`Are you sure you want to reset the daily limit for "${domain}"?`)) {
          chrome.runtime.sendMessage({ type: 'RESET_TRACKING', target: `s:${domain}` }, (response) => {
             if (response && response.success) {
               softRefresh();
             }
          });
        }
      });
    });

    document.querySelectorAll('.limit-input-st').forEach(input => {
      input.addEventListener('change', (e) => {
        const domain = e.currentTarget.dataset.domain;
        const newLimit = parseInt(e.target.value, 10);
        if (newLimit >= 1 && newLimit <= 1440) {
          config.standalone[domain].limit = newLimit;
          saveConfig();
        }
      });
    });
  }

  // Form Submit Handlers
  addCategoryForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const nameInput = document.getElementById('newCategoryName');
    const limitInput = document.getElementById('newCategoryLimit');
    const name = nameInput.value.trim();
    const limit = parseInt(limitInput.value, 10);

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
    const limit = parseInt(limitInput.value, 10);

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

  async function softRefresh() {
    chrome.runtime.sendMessage({ type: 'GET_TRACKING_DATA' }, (tracking) => {
      if (chrome.runtime.lastError || !tracking) return;
      config.tracking = tracking;

      document.querySelectorAll('.cat-remain-time').forEach(span => {
        const name = span.dataset.category;
        const cat = config.categories[name];
        if (cat) {
          const spentMs = config.tracking.spent[`c:${name}`] || 0;
          const limitMs = (cat.limit || 0) * 60 * 1000;
          const remainMs = Math.max(0, limitMs - spentMs);
          const remainMin = Math.ceil(remainMs / 60000);
          span.textContent = `${remainMin} min left`;
          span.style.color = remainMin === 0 ? 'var(--error-color)' : 'var(--success-color)';
        }
      });

      document.querySelectorAll('.st-remain-time').forEach(span => {
        const domain = span.dataset.domain;
        const itemObj = config.standalone[domain];
        if (itemObj) {
          const spentMs = config.tracking.spent[`s:${domain}`] || 0;
          const limitMs = (itemObj.limit || 0) * 60 * 1000;
          const remainMs = Math.max(0, limitMs - spentMs);
          const remainMin = Math.ceil(remainMs / 60000);
          span.textContent = `${remainMin} min left`;
          span.style.color = remainMin === 0 ? 'var(--error-color)' : 'var(--success-color)';
        }
      });

      document.querySelectorAll('.cat-status-icon').forEach(icon => {
        const name = icon.dataset.category;
        const cat = config.categories[name];
        if (cat) {
          const spentMs = config.tracking.spent[`c:${name}`] || 0;
          const limitMs = (cat.limit || 0) * 60 * 1000;
          const remainMs = Math.max(0, limitMs - spentMs);
          const remainMin = Math.ceil(remainMs / 60000);
          icon.style.color = remainMin === 0 ? 'var(--error-color)' : 'var(--success-color)';
        }
      });

      document.querySelectorAll('.st-status-icon').forEach(icon => {
        const domain = icon.dataset.domain;
        const itemObj = config.standalone[domain];
        if (itemObj) {
          const spentMs = config.tracking.spent[`s:${domain}`] || 0;
          const limitMs = (itemObj.limit || 0) * 60 * 1000;
          const remainMs = Math.max(0, limitMs - spentMs);
          const remainMin = Math.ceil(remainMs / 60000);
          icon.style.color = remainMin === 0 ? 'var(--error-color)' : 'var(--success-color)';
        }
      });
    });
  }

  loadConfig();

  // Periodically refresh the options page UI every 1 second to update remaining limits softly while it is open.
  setInterval(softRefresh, 10000);
});
