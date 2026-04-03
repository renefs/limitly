// Store default config structure
const DEFAULT_CATEGORIES = {
  // e.g. "News": { limitMinutes: 30, websites: ["cnn.com", "nytimes.com"] }
};

// Extracted base domain helper
function getBaseDomain(url) {
  try {
    const urlObj = new URL(url);
    let hostname = urlObj.hostname;
    if (hostname.startsWith('www.')) {
      hostname = hostname.slice(4);
    }
    return hostname;
  } catch (e) {
    return "";
  }
}

// Get standard date string 'YYYY-MM-DD'
function getTodayString() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Wrap chrome storage API with promises
const StorageAPI = {
  get: (keys) => new Promise(resolve => chrome.storage.local.get(keys, resolve)),
  set: (items) => new Promise(resolve => chrome.storage.local.set(items, resolve)),
  remove: (keys) => new Promise(resolve => chrome.storage.local.remove(keys, resolve))
};

// Calculate remaining time from a limit (in minutes) and time spent (in ms)
function getRemainingTime(limitMinutes, spentMs) {
  const limitMs = (limitMinutes || 0) * 60 * 1000;
  const remainMs = Math.max(0, limitMs - spentMs);
  const remainMin = Math.ceil(remainMs / 60000);
  return { limitMs, remainMs, remainMin };
}

// Message type constants
const MSG = {
  CONFIG_UPDATED:    'CONFIG_UPDATED',
  RENAME_CATEGORY:   'RENAME_CATEGORY',
  REMOVE_TARGET:     'REMOVE_TARGET',
  RESET_TRACKING:    'RESET_TRACKING',
  GET_TRACKING_DATA: 'GET_TRACKING_DATA',
  GET_CURRENT_STATE: 'GET_CURRENT_STATE',
  OPEN_OPTIONS_PAGE: 'OPEN_OPTIONS_PAGE',
  TIMER_UPDATE:      'TIMER_UPDATE',
  DAY_ROLLED_OVER:   'DAY_ROLLED_OVER',
};

// Promise-based message sender
function sendMessage(type, data = {}) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type, ...data }, (response) => {
      if (chrome.runtime.lastError) resolve(undefined);
      else resolve(response);
    });
  });
}
