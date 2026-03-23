// js/options.js
document.addEventListener('DOMContentLoaded', async () => {
  const data = await storage.get(['categories', 'standalone']);
  let categories = data.categories || {};
  let standalone = data.standalone || {};

  // Form Elements
  const addCategoryForm = document.getElementById('addCategoryForm');
  const addWebsiteForm = document.getElementById('addWebsiteForm');
  const addStandaloneForm = document.getElementById('addStandaloneForm');
  const categorySelect = document.getElementById('websiteCategorySelect');

  // List Containers
  const categoriesList = document.getElementById('categoriesList');
  const standaloneList = document.getElementById('standaloneList');

  // Save changes back to storage
  async function saveData() {
    await storage.set({ categories, standalone });
    render();
  }

  // Handle Event: Add Category
  addCategoryForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('newCategoryName').value.trim();
    const limit = parseInt(document.getElementById('newCategoryLimit').value, 10);
    
    if (name && !categories[name]) {
      categories[name] = { limit, sites: [] };
      addCategoryForm.reset();
      await saveData();
    }
  });

  // Handle Event: Add Website to Category
  addWebsiteForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const selectedCat = categorySelect.value;
    const urlInput = document.getElementById('newWebsiteDomain').value.trim();
    const domain = getBaseDomain(urlInput) || urlInput; // Fallback if url is purely a domain
    
    if (selectedCat && domain && !categories[selectedCat].sites.includes(domain)) {
      categories[selectedCat].sites.push(domain);
      addWebsiteForm.reset();
      await saveData();
    }
  });

  // Handle Event: Add Standalone Website
  addStandaloneForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const urlInput = document.getElementById('newStandaloneDomain').value.trim();
    const domain = getBaseDomain(urlInput) || urlInput;
    const limit = parseInt(document.getElementById('newStandaloneLimit').value, 10);
    
    if (domain && limit && !standalone[domain]) {
      standalone[domain] = { limit };
      addStandaloneForm.reset();
      await saveData();
    }
  });

  // Remove Category completely
  window.removeCategory = async (name) => {
    delete categories[name];
    await saveData();
  };

  // Remove individual site from a specific category
  window.removeSiteFromCategory = async (catName, siteIndex) => {
    categories[catName].sites.splice(siteIndex, 1);
    await saveData();
  };

  // Remove standalone site completely
  window.removeStandalone = async (domain) => {
    delete standalone[domain];
    await saveData();
  };

  // Main UI refresh routine
  function render() {
    // Populate select dropdown
    categorySelect.innerHTML = '<option value="" disabled selected>Select Category...</option>';
    Object.keys(categories).forEach(cat => {
      const option = document.createElement('option');
      option.value = cat;
      option.textContent = cat;
      categorySelect.appendChild(option);
    });

    // Populate Category List
    categoriesList.innerHTML = '';
    for (const [name, config] of Object.entries(categories)) {
      const item = document.createElement('div');
      item.className = 'list-item';
      
      const siteTags = config.sites.map((site, idx) => 
        `<span class="site-tag">${site} <a href="#" onclick="removeSiteFromCategory('${name}', ${idx}); return false;" style="color:red; text-decoration:none;">&times;</a></span>`
      ).join('');

      item.innerHTML = `
        <div style="flex:1;">
          <strong>${name}</strong> (${config.limit}m limit)<br>
          ${siteTags}
        </div>
        <button class="danger-btn" onclick="removeCategory('${name}')">Delete</button>
      `;
      categoriesList.appendChild(item);
    }

    // Populate Standalone List
    standaloneList.innerHTML = '';
    for (const [domain, config] of Object.entries(standalone)) {
      const item = document.createElement('div');
      item.className = 'list-item';
      item.innerHTML = `
        <div style="flex:1;">
          <strong>${domain}</strong> (${config.limit}m limit)
        </div>
        <button class="danger-btn" onclick="removeStandalone('${domain}')">Delete</button>
      `;
      standaloneList.appendChild(item);
    }
  }

  // Initial load
  render();
});