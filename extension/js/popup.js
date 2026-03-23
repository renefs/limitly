document.addEventListener('DOMContentLoaded', async () => {
    const currentDomainDisplay = document.getElementById('currentDomainDisplay');
    const categorySelect = document.getElementById('quickCategorySelect');
    const limitInput = document.getElementById('quickStandaloneLimit');
    const quickAddForm = document.getElementById('quickAddForm');
    const statusMessage = document.getElementById('statusMessage');
    
    let currentDomain = '';
  
    // 1. Get the current active tab's domain
    const tabs = await new Promise(resolve => {
        chrome.tabs.query({ active: true, currentWindow: true }, resolve);
    });
    
    if (tabs.length > 0 && tabs[0].url) {
        currentDomain = getBaseDomain(tabs[0].url);
        currentDomainDisplay.textContent = currentDomain || "Unsupported Page";
        if (!currentDomain) quickAddForm.style.display = 'none';
    }
  
    // 2. Load Categories from storage and populate the dropdown
    const data = await storage.get(['categories', 'standalone']);
    const categories = data.categories || {};
    const standalone = data.standalone || {};
  
    Object.keys(categories).forEach(catName => {
      const option = document.createElement('option');
      option.value = `cat_${catName}`;
      option.textContent = `Add to Category: ${catName}`;
      categorySelect.appendChild(option);
    });
  
    // Toggle the minutes input depending on if standalone is selected
    categorySelect.addEventListener('change', () => {
        if (categorySelect.value === 'standalone') {
            limitInput.style.display = 'block';
            limitInput.required = true;
        } else {
            limitInput.style.display = 'none';
            limitInput.required = false;
        }
    });
  
    // 3. Handle Submit
    quickAddForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        if (!currentDomain) return;
  
        const selection = categorySelect.value;
        statusMessage.textContent = '';
        
        if (selection === 'standalone') {
            // Add as standalone limit
            const limit = parseInt(limitInput.value, 10);
            standalone[currentDomain] = { limit: limit };
            await storage.set({ standalone });
            statusMessage.textContent = 'Saved standalone limit!';
        } else if (selection.startsWith('cat_')) {
            // Add to existing category
            const catName = selection.substring(4);
            if (!categories[catName].sites.includes(currentDomain)) {
                categories[catName].sites.push(currentDomain);
                await storage.set({ categories });
            }
            statusMessage.textContent = `Added to ${catName}!`;
        }
  
        // Re-evaluate background state immediately so tracking kicks in
        chrome.runtime.sendMessage({ type: 'FORCE_UPDATE_STATE' }).catch(() => {});
        
        setTimeout(() => window.close(), 1500);
    });
  
    // 4. Hook up the options page button
    document.getElementById('openOptions').addEventListener('click', () => {
        if (chrome.runtime.openOptionsPage) {
            chrome.runtime.openOptionsPage();
        } else {
            window.open(chrome.runtime.getURL('html/options.html'));
        }
    });
  });