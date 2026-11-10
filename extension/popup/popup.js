/**
 * ColdDM Popup Script
 */

const DEFAULT_BACKEND_URL = 'http://localhost:5000';
const DAILY_LIMIT = 25;

function getTodayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

document.addEventListener('DOMContentLoaded', async () => {
  const urlInput = document.getElementById('backend-url-input');
  const directKeyInput = document.getElementById('direct-key-input');
  const saveUrlBtn = document.getElementById('save-url-btn');
  const saveKeyBtn = document.getElementById('save-key-btn');
  const testConnBtn = document.getElementById('test-connection-btn');
  const resetQuotaBtn = document.getElementById('reset-quota-btn');

  const quotaCountEl = document.getElementById('quota-count');
  const progressBarEl = document.getElementById('quota-progress-bar');
  const remainingTextEl = document.getElementById('quota-remaining-text');

  const connectionIndicator = document.getElementById('connection-indicator');
  const connectionText = document.getElementById('connection-text');

  // 1. Load Stored Data
  chrome.storage.local.get(['colddm_backend_url', 'colddm_direct_key', 'colddm_daily_quota'], (res) => {
    const backendUrl = res.colddm_backend_url || DEFAULT_BACKEND_URL;
    urlInput.value = backendUrl;

    if (res.colddm_direct_key) {
      directKeyInput.value = res.colddm_direct_key;
    }

    // Refresh Quota UI
    const today = getTodayKey();
    const quota = res.colddm_daily_quota || { date: today, count: 0 };
    if (quota.date !== today) {
      quota.date = today;
      quota.count = 0;
      chrome.storage.local.set({ colddm_daily_quota: quota });
    }
    updateQuotaUI(quota.count);

    // Test connection on launch
    checkBackendHealth(backendUrl);
  });

  // 2. Update Quota UI
  function updateQuotaUI(count) {
    const used = Math.min(count, DAILY_LIMIT);
    const remaining = Math.max(0, DAILY_LIMIT - used);
    quotaCountEl.innerText = `${used} / ${DAILY_LIMIT}`;
    const pct = (used / DAILY_LIMIT) * 100;
    progressBarEl.style.width = `${pct}%`;

    if (used >= DAILY_LIMIT) {
      progressBarEl.classList.add('exceeded');
      remainingTextEl.innerText = `0 generations left (Limit reached)`;
    } else {
      progressBarEl.classList.remove('exceeded');
      remainingTextEl.innerText = `${remaining} generation${remaining === 1 ? '' : 's'} remaining`;
    }
  }

  // 3. Health Check
  async function checkBackendHealth(url) {
    connectionIndicator.className = 'status-indicator';
    connectionText.innerText = 'Checking...';

    try {
      const cleanUrl = url.replace(/\/+$/, '');
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const res = await fetch(`${cleanUrl}/api/health`, { signal: controller.signal });
      clearTimeout(timeoutId);

      const data = await res.json();
      if (res.ok && data.status === 'healthy') {
        connectionIndicator.className = 'status-indicator connected';
        connectionText.innerText = 'Connected';
      } else {
        throw new Error('Unhealthy status');
      }
    } catch (err) {
      connectionIndicator.className = 'status-indicator error';
      connectionText.innerText = 'Offline';
    }
  }

  // 4. Save Backend URL
  saveUrlBtn.addEventListener('click', () => {
    let url = urlInput.value.trim();
    if (!url) url = DEFAULT_BACKEND_URL;
    chrome.storage.local.set({ colddm_backend_url: url }, () => {
      saveUrlBtn.innerText = 'Saved!';
      setTimeout(() => { saveUrlBtn.innerText = 'Save'; }, 1500);
      checkBackendHealth(url);
    });
  });

  // 5. Save Direct Key Override
  saveKeyBtn.addEventListener('click', () => {
    const key = directKeyInput.value.trim();
    chrome.storage.local.set({ colddm_direct_key: key }, () => {
      saveKeyBtn.innerText = 'Saved!';
      setTimeout(() => { saveKeyBtn.innerText = 'Save'; }, 1500);
    });
  });

  // 6. Test Connection Button
  testConnBtn.addEventListener('click', () => {
    const url = urlInput.value.trim() || DEFAULT_BACKEND_URL;
    checkBackendHealth(url);
  });

  // 7. Reset Quota Button
  resetQuotaBtn.addEventListener('click', () => {
    const today = getTodayKey();
    const quota = { date: today, count: 0 };
    chrome.storage.local.set({ colddm_daily_quota: quota }, () => {
      updateQuotaUI(0);
      alert('Daily quota has been reset to 0/25 for testing!');
    });
  });
});

