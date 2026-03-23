// background.js - Main service worker

importScripts('common.js');

// --- Global Tracking State ---
let activeTabId = null;
let activeWindowId = null;
let activeTarget = null; // Stored as "s:{domain}" or "c:{category_name}"
let activeStartTime = null;

// Initialize default settings when the extension is installed
chrome.runtime.onInstalled.addListener(async () => {
  console.log("Limitly installed. Initializing defaults...");
  
  const data = await storage.get(['categories', 'tracking', 'lastResetDate']);
  const today = getTodayString();
  
  const defaults = {};
  
  // Set up empty categories if they don't exist
  if (!data.categories) {
    defaults.categories = {};
  }
  
  // Set up tracking structure for today
  if (!data.tracking || data.lastResetDate !== today) {
    defaults.tracking = { date: today, spent: {} };
    defaults.lastResetDate = today;
  }
  
  if (Object.keys(defaults).length > 0) {
    await storage.set(defaults);
    console.log("Defaults initialized:", defaults);
  }
});

// Set up a daily alarm to check and reset tracking over midnight
chrome.alarms.create("dailyResetCheck", { periodInMinutes: 5 });

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === "dailyResetCheck") {
    const data = await storage.get(['tracking', 'lastResetDate']);
    const today = getTodayString();
    
    // If the day changed, reset the tracking object
    if (data.lastResetDate !== today) {
        console.log("Day rolled over! Resetting limits.");
        await storage.set({
            tracking: { date: today, spent: {} },
            lastResetDate: today
        });
    }
  }
});

// --- Target Resolution ---

// Simple helper to load config safely
async function getConfig() {
  const data = await storage.get(['categories', 'standalone', 'tracking']);
  if (!data.categories) data.categories = {};
  if (!data.standalone) data.standalone = {};
  if (!data.tracking) data.tracking = { date: getTodayString(), spent: {} };
  return data;
}

function findTargetForDomain(domain, categories, standalone) {
  // Check exact standalone domains
  if (standalone[domain]) {
    return { type: 'standalone', id: domain, data: standalone[domain] };
  }
  
  // Check category grouping
  for (const [catName, catData] of Object.entries(categories)) {
    if (catData.sites && catData.sites.some(site => domain === site || domain.endsWith('.' + site))) {
      return { type: 'category', id: catName, data: catData };
    }
  }
  
  return null;
}

// --- Tracking Logic ---

async function commitActiveTime() {
  if (!activeTarget || !activeStartTime) return;
  
  const now = Date.now();
  const elapsed = now - activeStartTime;
  
  if (elapsed > 0) {
    const config = await getConfig();
    const today = getTodayString();
    
    // Only continue if the config date matches today (prevents writing to yesterday's logs)
    if (config.tracking.date === today) {
      config.tracking.spent[activeTarget] = (config.tracking.spent[activeTarget] || 0) + elapsed;
      await storage.set({ tracking: config.tracking });
    }
    
    // Reset our start timer
    activeStartTime = now;
  }
}

async function updateActiveState(windowId) {
  // First, save the time spent on the PREVIOUS tab
  await commitActiveTime();
  
  // If no window is active, pause tracking
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    activeTarget = null;
    activeStartTime = null;
    return;
  }
  
  // Find currently active tab
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
      
      const config = await getConfig();
      const target = findTargetForDomain(domain, config.categories, config.standalone);
      
      // If the domain is tracked, bind to it and start the timer
      if (target) {
        activeTarget = target.type === 'category' ? `c:${target.id}` : `s:${target.id}`;
        activeStartTime = Date.now();
        console.log(`Started tracking ${activeTarget}`);
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

// --- Listeners --- 
chrome.tabs.onActivated.addListener(({ windowId }) => updateActiveState(windowId));
chrome.windows.onFocusChanged.addListener(updateActiveState);
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Update state if the current tab navigated to a new URL
  if (tabId === activeTabId && changeInfo.url) {
    updateActiveState(activeWindowId);
  }
});
