// common.js - Shared utilities for the extension

/**
 * Extracts the base domain from a full URL
 * Example: https://www.reddit.com/r/webdev -> reddit.com
 */
function getBaseDomain(url) {
  try {
    const urlObj = new URL(url);
    let hostname = urlObj.hostname;
    // Strip the www. prefix if it exists
    if (hostname.startsWith('www.')) {
      hostname = hostname.slice(4);
    }
    return hostname;
  } catch (e) {
    return "";
  }
}

/**
 * Returns today's date as a string formatted as YYYY-MM-DD
 * Used for tracking daily limits and resetting time.
 */
function getTodayString() {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// A simple Promise-based wrapper for chrome.storage.local
const storage = {
  get: (keys) => new Promise(resolve => chrome.storage.local.get(keys, resolve)),
  set: (items) => new Promise(resolve => chrome.storage.local.set(items, resolve))
};
