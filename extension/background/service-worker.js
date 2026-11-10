/**
 * ColdDM Background Service Worker (Manifest V3)
 */

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('ColdDM Chrome Extension successfully installed!');
    const today = new Date().toISOString().split('T')[0];
    chrome.storage.local.set({
      colddm_daily_quota: { date: today, count: 0 },
      colddm_backend_url: 'http://localhost:5000'
    });
  }
});

