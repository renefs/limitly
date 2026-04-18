importScripts('common.js');

let activeTabId = null;
let activeWindowId = null;
let activeTarget = null; // format: "c:News" or "s:reddit.com"
let activeStartTime = null;

let configPromise = null;

async function checkConfig() {
  if (configPromise) return configPromise;
  configPromise = _loadConfig().finally(() => { configPromise = null; });
  return configPromise;
}

async function _loadConfig() {
  const data = await StorageAPI.get(['categories', 'standalone', 'tracking', 'showTimer', 'theme', 'lastResetDate']);
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

  const lastDate = data.lastResetDate || data.tracking?.date || null;

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
    await StorageAPI.set(data);
  }

  if (dayRolledOver) {
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach(tab => {
        try {
          chrome.tabs.sendMessage(tab.id, { type: MSG.DAY_ROLLED_OVER });
        } catch(e) {}
      });
    });
  }

  return data;
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
  const periodStart = activeStartTime;
  const elapsed = now - periodStart;

  if (elapsed > 0) {
    const targetToCommit = activeTarget;
    activeStartTime = now;

    // Discard elapsed time that spans a day boundary (e.g. overnight sleep/idle).
    // The user wasn't actively browsing during that gap.
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    if (periodStart < todayStart.getTime()) {
      return;
    }

    // Ignore massive elapsed periods (device sleep/hibernate) 
    // The alarm triggers every 1 minute, so >5 min means it was sleeping
    if (elapsed > 5 * 60 * 1000) {
      return;
    }

    const data = await checkConfig();
    if (data.tracking.date === getTodayString()) {
      data.tracking.spent[targetToCommit] = (data.tracking.spent[targetToCommit] || 0) + elapsed;
      await StorageAPI.set({ tracking: data.tracking });
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
  const { limitMs, remainMs: remainingMs } = getRemainingTime(targetData.limit, spentTime);
  
  try {
    chrome.tabs.sendMessage(tabId, {
      type: MSG.TIMER_UPDATE,
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

chrome.alarms.onAlarm.addListener((alarm) => {
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
  if (message.type === MSG.GET_CURRENT_STATE) {
    commitActiveTime().then(async () => {
      const data = await checkConfig();
      const domain = getBaseDomain(sender.tab?.url || message.url);
      const target = findTargetForDomain(domain, data.categories, data.standalone);
      
      if (target) {
        const key = getTargetKey(target.type, target.id);
        const spent = data.tracking.spent[key] || 0;
        const { limitMs, remainMs: remainingMs } = getRemainingTime(target.data.limit, spent);
        
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
  
  if (message.type === MSG.RESET_TRACKING) {
    checkConfig().then(async (data) => {
      if (data.tracking && data.tracking.spent) {
        data.tracking.spent[message.target] = 0;
        await StorageAPI.set({ tracking: data.tracking });
        updateActiveState();
        sendResponse({ success: true });
      }
    });
    return true;
  }

  if (message.type === MSG.REMOVE_TARGET) {
    checkConfig().then(async (data) => {
      if (data.tracking && data.tracking.spent) {
        delete data.tracking.spent[message.target];
        await StorageAPI.set({ tracking: data.tracking });
        updateActiveState();
        sendResponse({ success: true });
      }
    });
    return true;
  }

  if (message.type === MSG.RENAME_CATEGORY) {
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
        await StorageAPI.set({ categories: data.categories, tracking: data.tracking });
        updateActiveState();
        sendResponse({ success: true });
      }
    });
    return true;
  }

  if (message.type === MSG.CONFIG_UPDATED) {
    updateActiveState();
  }
  
  if (message.type === MSG.GET_TRACKING_DATA) {
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
  
  if (message.type === MSG.OPEN_OPTIONS_PAGE) {
    chrome.runtime.openOptionsPage();
  }
});

checkConfig();
updateActiveState();
