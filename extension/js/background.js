// Simple storage wrapper
const storage = {
  get: (keys) => new Promise(resolve => chrome.storage.local.get(keys, resolve)),
  set: (items) => new Promise(resolve => chrome.storage.local.set(items, resolve)),
};

function getBaseDomain(url) {
  try {
    const urlObj = new URL(url);
    let hostname = urlObj.hostname;
    // Basic prefix stripping
    if (hostname.startsWith('www.')) {
      hostname = hostname.slice(4);
    }
    return hostname;
  } catch (e) {
    return "";
  }
}

function getTodayString() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

let activeTabId = null;
let activeWindowId = null;
let activeTarget = null; // format: "c:News" or "s:reddit.com"
let activeStartTime = null;

let isCheckingConfig = false;
let checkConfigPromise = null;

async function checkConfig() {
  if (isCheckingConfig) return checkConfigPromise;
  
  isCheckingConfig = true;
  checkConfigPromise = (async () => {
    const data = await storage.get(['categories', 'standalone', 'tracking', 'showTimer', 'theme', 'lastResetDate']);
    const today = getTodayString();
    
    let needsSave = false;
    let dayRolledOver = false;

    if (!data.categories) {
      data.categories = {};
      needsSave = true;
    }
    if (!data.standalone) {
      data.standalone = {};
      needsSave = true;
    }
    
    // Check if the day has changed since the last tracking date or last reset
    const lastDate = data.lastResetDate || (data.tracking ? data.tracking.date : null);
    
    if (lastDate !== today) {
      if (lastDate) {
        dayRolledOver = true;
      }
      data.tracking = { date: today, spent: {} };
      data.lastResetDate = today;
      needsSave = true;
    } else if (!data.tracking) {
      data.tracking = { date: today, spent: {} };
      needsSave = true;
    }

    if (data.showTimer === undefined) {
      data.showTimer = true;
      needsSave = true;
    }
    if (data.theme === undefined) {
      data.theme = 'auto';
      needsSave = true;
    }
    
    if (needsSave) {
      await storage.set(data);
    }

    if (dayRolledOver) {
      chrome.tabs.query({}, (tabs) => {
        tabs.forEach(tab => {
          try {
            chrome.tabs.sendMessage(tab.id, { type: 'DAY_ROLLED_OVER' });
          } catch(e) {}
        });
      });
    }

    return data;
  })();

  const result = await checkConfigPromise;
  isCheckingConfig = false;
  checkConfigPromise = null;
  return result;
}

// Find target for a given domain
function findTargetForDomain(domain, categories, standalone) {
  // Check standalone first, it should take precedence
  for (const [site, data] of Object.entries(standalone)) {
    if (domain === site || domain.endsWith('.' + site)) return { type: 'standalone', id: site, name: site, data: data };
  }
  // Check categories next
  for (const [catName, catData] of Object.entries(categories)) {
    if (catData.sites && catData.sites.some(site => domain === site || domain.endsWith('.' + site))) {
      return { type: 'category', id: catName, name: catName, data: catData };
    }
  }
  return null;
}

function getTargetKey(type, id) {
  return type === 'category' ? `c:${id}` : `s:${id}`;
}

// Update time spent for the currently active target
async function commitActiveTime() {
  if (!activeTarget || !activeStartTime) return;
  
  const now = Date.now();
  const elapsed = now - activeStartTime;
  
  if (elapsed > 0) {
    const targetToCommit = activeTarget;
    activeStartTime = now;
    
    // Always use checkConfig to ensure we have the correct day's tracking object
    const data = await checkConfig();
    const today = getTodayString();
    
    if (data.tracking.date === today) {
      data.tracking.spent[targetToCommit] = (data.tracking.spent[targetToCommit] || 0) + elapsed;
      await storage.set({ tracking: data.tracking });
    } else {
      // If we are here, it means checkConfig should have already reset it but let's be double sure.
      // We don't want to save time to an old day's tracking if the date has moved on.
      const freshData = await checkConfig();
      freshData.tracking.spent[targetToCommit] = (freshData.tracking.spent[targetToCommit] || 0) + elapsed;
      await storage.set({ tracking: freshData.tracking });
    }
  } else {
    activeStartTime = now;
  }
}

// Handle tab or window changes
async function updateActiveState(windowId) {
  await commitActiveTime();
  
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    activeTarget = null;
    activeStartTime = null;
    return;
  }
  
  chrome.tabs.query({ active: true, lastFocusedWindow: true }, async (tabs) => {
    if (tabs && tabs.length > 0) {
      const tab = tabs[0];
      activeTabId = tab.id;
      activeWindowId = tab.windowId;
      
      const domain = getBaseDomain(tab.url);
      if (!domain) {
        activeTarget = null;
        activeStartTime = null;
        return;
      }
      
      const data = await checkConfig();
      const target = findTargetForDomain(domain, data.categories, data.standalone);
      
      if (target) {
        activeTarget = getTargetKey(target.type, target.id);
        activeStartTime = Date.now();
        const spent = data.tracking.spent[activeTarget] || 0;
        checkLimitsAndNotify(target.data, spent, target.name, tab.id);
      } else {
        activeTarget = null;
        activeStartTime = null;
      }
    } else {
      activeTarget = null;
      activeStartTime = null;
    }
  });
}

async function checkLimitsAndNotify(targetData, spentTime, displayName, tabId) {
  const limitMs = (targetData.limit || 0) * 60 * 1000;
  const remainingMs = Math.max(0, limitMs - spentTime);
  
  try {
    chrome.tabs.sendMessage(tabId, {
      type: 'TIMER_UPDATE',
      category: displayName,
      remainingMs: remainingMs,
      limitMs: limitMs
    });
  } catch (e) {
    // Content script might not be loaded yet
  }
}

// Listeners
chrome.tabs.onActivated.addListener(updateActiveState);
chrome.windows.onFocusChanged.addListener(updateActiveState);
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (tabId === activeTabId && changeInfo.url) {
    updateActiveState();
  }
});

chrome.alarms.create("timeSync", { periodInMinutes: 1 });

function scheduleNextMidnightReset() {
  const next = new Date();
  next.setHours(24, 0, 0, 0);
  chrome.alarms.create("midnightReset", { when: next.getTime() });
}
scheduleNextMidnightReset();

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "midnightReset") {
    commitActiveTime().then(async () => {
      // Force checking config to ensure tracking date resets and listeners are notified
      await checkConfig();
      // Update limits to all active tabs
      updateActiveState();
    });
    scheduleNextMidnightReset();
  }
  
  if (alarm.name === "timeSync") {
    commitActiveTime();
    chrome.tabs.query({ active: true, lastFocusedWindow: true }, async (tabs) => {
      if (tabs && tabs.length > 0) {
        const tab = tabs[0];
        const domain = getBaseDomain(tab.url);
        if (domain && activeTarget) {
          const data = await checkConfig();
          const target = findTargetForDomain(domain, data.categories, data.standalone);
          if (target && getTargetKey(target.type, target.id) === activeTarget) {
            const spent = data.tracking.spent[activeTarget] || 0;
            checkLimitsAndNotify(target.data, spent, target.name, tab.id);
          }
        }
      }
    });
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_CURRENT_STATE') {
    commitActiveTime().then(async () => {
      const data = await checkConfig();
      const domain = getBaseDomain(sender.tab?.url || message.url);
      const target = findTargetForDomain(domain, data.categories, data.standalone);
      
      if (target) {
        const key = getTargetKey(target.type, target.id);
        const spent = data.tracking.spent[key] || 0;
        const limitMs = (target.data.limit || 0) * 60 * 1000;
        const remainingMs = Math.max(0, limitMs - spent);
        
        sendResponse({
          isActive: true,
          category: target.name,
          remainingMs: remainingMs,
          limitMs: limitMs,
          showTimer: data.showTimer,
          theme: data.theme
        });
      } else {
        sendResponse({ isActive: false });
      }
    });
    return true; // Keep message channel open for async response
  }
  
  if (message.type === 'RESET_TRACKING') {
    checkConfig().then(async (data) => {
      if (data.tracking && data.tracking.spent) {
        data.tracking.spent[message.target] = 0;
        await storage.set({ tracking: data.tracking });
        updateActiveState();
        sendResponse({ success: true });
      }
    });
    return true;
  }

  if (message.type === 'REMOVE_TARGET') {
    checkConfig().then(async (data) => {
      if (data.tracking && data.tracking.spent) {
        delete data.tracking.spent[message.target];
        await storage.set({ tracking: data.tracking });
        updateActiveState();
        sendResponse({ success: true });
      }
    });
    return true;
  }

  if (message.type === 'RENAME_CATEGORY') {
    checkConfig().then(async (data) => {
      const { oldName, newName } = message;
      if (data.categories[oldName]) {
        data.categories[newName] = data.categories[oldName];
        delete data.categories[oldName];
        
        if (data.tracking && data.tracking.spent) {
          const oldKey = `c:${oldName}`;
          const newKey = `c:${newName}`;
          if (data.tracking.spent[oldKey] !== undefined) {
            data.tracking.spent[newKey] = data.tracking.spent[oldKey];
            delete data.tracking.spent[oldKey];
          }
        }
        await storage.set({ categories: data.categories, tracking: data.tracking });
        updateActiveState();
        sendResponse({ success: true });
      }
    });
    return true;
  }

  if (message.type === 'CONFIG_UPDATED') {
    updateActiveState();
  }
  
  if (message.type === 'GET_TRACKING_DATA') {
    checkConfig().then((data) => {
      const tracking = JSON.parse(JSON.stringify(data.tracking));
      if (activeTarget && activeStartTime) {
        const elapsed = Date.now() - activeStartTime;
        tracking.spent[activeTarget] = (tracking.spent[activeTarget] || 0) + elapsed;
      }
      sendResponse(tracking);
    });
    return true;
  }
  
  if (message.type === 'OPEN_OPTIONS_PAGE') {
    chrome.runtime.openOptionsPage();
  }
});

checkConfig();
updateActiveState();
