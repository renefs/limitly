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
