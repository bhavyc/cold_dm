/**
 * ReplyWave Background Service Worker (Manifest V3)
 */

const PRODUCTION_API_URL = 'https://replywave-omega.vercel.app';

chrome.runtime.onInstalled.addListener((details) => {
  const today = new Date().toISOString().split('T')[0];
  if (details.reason === 'install') {
    chrome.storage.local.set({
      colddm_daily_quota: { date: today, count: 0 },
      colddm_backend_url: PRODUCTION_API_URL
    });
  } else if (details.reason === 'update') {
    chrome.storage.local.set({
      colddm_backend_url: PRODUCTION_API_URL
    });
  }
});
