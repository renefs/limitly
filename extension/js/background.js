// background.js - Main service worker

importScripts('common.js');

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
