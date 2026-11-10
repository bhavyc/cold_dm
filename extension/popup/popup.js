/**
 * ReplyWave Popup Script - Clean User Experience
 */

const DAILY_LIMIT = 25;

function getTodayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

document.addEventListener('DOMContentLoaded', () => {
  const quotaCountEl = document.getElementById('quota-count');
  const progressBarEl = document.getElementById('quota-progress-bar');
  const remainingTextEl = document.getElementById('quota-remaining-text');
  const openLinkedInBtn = document.getElementById('open-linkedin-btn');
  const shareBtn = document.getElementById('share-btn');

  // 1. Load Quota Data
  chrome.storage.local.get(['colddm_daily_quota'], (res) => {
    const today = getTodayKey();
    const quota = res.colddm_daily_quota || { date: today, count: 0 };
    if (quota.date !== today) {
      quota.date = today;
      quota.count = 0;
      chrome.storage.local.set({ colddm_daily_quota: quota });
    }
    updateQuotaUI(quota.count || 0);
  });

  function updateQuotaUI(count) {
    const used = Math.min(count, DAILY_LIMIT);
    const remaining = Math.max(0, DAILY_LIMIT - used);
    quotaCountEl.innerText = `${used} / ${DAILY_LIMIT}`;
    const pct = (used / DAILY_LIMIT) * 100;
    progressBarEl.style.width = `${pct}%`;

    if (used >= DAILY_LIMIT) {
      progressBarEl.classList.add('exceeded');
      remainingTextEl.innerText = `0 credits remaining (Resets tomorrow)`;
    } else {
      progressBarEl.classList.remove('exceeded');
      remainingTextEl.innerText = `${remaining} icebreaker${remaining === 1 ? '' : 's'} remaining`;
    }
  }

  // 2. Open LinkedIn CTA
  openLinkedInBtn.addEventListener('click', () => {
    chrome.tabs.create({ url: 'https://www.linkedin.com/feed/' });
  });

  // 3. Share Button
  shareBtn.addEventListener('click', async () => {
    const shareText = 'Check out ReplyWave — it reads LinkedIn profiles and writes 3 natural cold DM icebreakers in 1 click!';
    try {
      await navigator.clipboard.writeText(shareText);
      const original = shareBtn.innerText;
      shareBtn.innerText = 'Invite message copied!';
      setTimeout(() => { shareBtn.innerText = original; }, 2000);
    } catch (e) {}
  });
});
