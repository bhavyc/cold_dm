/**
 * ColdDM - AI Cold DM Personalizer Chrome Extension
 * Content Script: DOM Scraper, Button Injection, Modal UI, & Quota Tracking
 */

(function () {
  'use strict';

  const DAILY_QUOTA_LIMIT = 25;
  const DEFAULT_BACKEND_URL = 'http://localhost:5000';

  let currentProspectData = null;
  let isGenerating = false;

  /* ==========================================================================
     1. Quota & Storage Helpers
     ========================================================================== */

  function getTodayKey() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  async function getQuotaInfo() {
    const today = getTodayKey();
    return new Promise((resolve) => {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(['colddm_daily_quota', 'colddm_backend_url', 'colddm_direct_key'], (res) => {
          const quota = res.colddm_daily_quota || { date: today, count: 0 };
          if (quota.date !== today) {
            quota.date = today;
            quota.count = 0;
            chrome.storage.local.set({ colddm_daily_quota: quota });
          }
          resolve({
            date: quota.date,
            count: quota.count || 0,
            remaining: Math.max(0, DAILY_QUOTA_LIMIT - (quota.count || 0)),
            isExceeded: (quota.count || 0) >= DAILY_QUOTA_LIMIT,
            backendUrl: res.colddm_backend_url || DEFAULT_BACKEND_URL,
            directKey: res.colddm_direct_key || ''
          });
        });
      } else {
        // Fallback if running outside chrome extension sandbox
        const raw = localStorage.getItem('colddm_daily_quota');
        let quota = raw ? JSON.parse(raw) : { date: today, count: 0 };
        if (quota.date !== today) {
          quota = { date: today, count: 0 };
          localStorage.setItem('colddm_daily_quota', JSON.stringify(quota));
        }
        resolve({
          date: quota.date,
          count: quota.count,
          remaining: Math.max(0, DAILY_QUOTA_LIMIT - quota.count),
          isExceeded: quota.count >= DAILY_QUOTA_LIMIT,
          backendUrl: DEFAULT_BACKEND_URL,
          directKey: ''
        });
      }
    });
  }

  async function incrementQuotaUsage() {
    const today = getTodayKey();
    return new Promise((resolve) => {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(['colddm_daily_quota'], (res) => {
          const quota = res.colddm_daily_quota || { date: today, count: 0 };
          if (quota.date !== today) {
            quota.date = today;
            quota.count = 1;
          } else {
            quota.count = (quota.count || 0) + 1;
          }
          chrome.storage.local.set({ colddm_daily_quota: quota }, () => {
            resolve(quota.count);
          });
        });
      } else {
        const raw = localStorage.getItem('colddm_daily_quota');
        let quota = raw ? JSON.parse(raw) : { date: today, count: 0 };
        quota.count = (quota.count || 0) + 1;
        localStorage.setItem('colddm_daily_quota', JSON.stringify(quota));
        resolve(quota.count);
      }
    });
  }

  /* ==========================================================================
     2. LinkedIn DOM Scraper
     ========================================================================== */

  function cleanProspectName(rawName) {
    if (!rawName) return '';
    // Strip pronouns e.g. (He/Him), (She/Her), (They/Them)
    let cleaned = rawName.replace(/\s*\((he\/him|she\/her|they\/them|he\/they|she\/they)[^)]*\)/gi, '');
    // Strip common suffixes / credentials: PhD, MBA, PMP, CPA, MD
    cleaned = cleaned.replace(/,\s*(PhD|MBA|PMP|CPA|MD|Esq|MS|BS)\b/gi, '');
    // Strip emoji characters
    cleaned = cleaned.replace(/([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g, '');
    return cleaned.trim();
  }

  function extractProspectData() {
    let name = '';
    let headline = '';
    let about = '';
    let recentPost = '';

    // 1. Prospect Name
    const nameSelectors = [
      'h1.inline.t-24.v-align-middle.break-words',
      'h1.text-heading-xlarge',
      'section.artdeco-card h1',
      '.pv-top-card--list h1',
      'div.ph5 h1',
      'h1'
    ];
    for (const sel of nameSelectors) {
      const el = document.querySelector(sel);
      if (el && el.innerText && el.innerText.trim()) {
        name = cleanProspectName(el.innerText.trim());
        if (name && !name.toLowerCase().includes('feed') && !name.toLowerCase().includes('linkedin')) break;
      }
    }

    // Fallback to title
    if (!name && document.title) {
      const parts = document.title.split('|')[0].split('-')[0].trim();
      if (parts && !parts.toLowerCase().includes('linkedin')) {
        name = cleanProspectName(parts);
      }
    }

    // 2. Current Headline / Role
    const headlineSelectors = [
      '.text-body-medium.break-words',
      'div[data-generated-suggestion-target]',
      '.pv-text-details__left-panel div.text-body-medium',
      'section.artdeco-card .text-body-medium',
      'div.pv-top-card--list-bullet'
    ];
    for (const sel of headlineSelectors) {
      const el = document.querySelector(sel);
      if (el && el.innerText && el.innerText.trim()) {
        headline = el.innerText.trim();
        break;
      }
    }

    // 3. About Section (first 200 words)
    const aboutSection = document.querySelector('section:has(#about), #about ~ div, section.artdeco-card:has(#about)');
    if (aboutSection) {
      const textEl = aboutSection.querySelector('.inline-show-more-text, .full-width span, .display-flex span');
      if (textEl && textEl.innerText) {
        let rawAbout = textEl.innerText.replace(/\s*\.\.\.see more/i, '').trim();
        const words = rawAbout.split(/\s+/);
        about = words.slice(0, 200).join(' ');
      }
    }

    // 4. Recent Post / Activity
    const activitySelectors = [
      '.feed-shared-update-v2__description',
      'section:has(#content_collections) span[dir="ltr"]',
      'section.artdeco-card:has(a[href*="/recent-activity/"]) span[dir="ltr"]'
    ];
    for (const sel of activitySelectors) {
      const el = document.querySelector(sel);
      if (el && el.innerText && el.innerText.trim()) {
        recentPost = el.innerText.replace(/\s*\.\.\.see more/i, '').trim().slice(0, 300);
        break;
      }
    }

    return {
      name: name || 'Prospect',
      headline: headline || '',
      about: about || '',
      recentPost: recentPost || '',
      profileUrl: window.location.href
    };
  }

  /* ==========================================================================
     3. Button Injection Logic (SPA Aware)
     ========================================================================== */

  function isLinkedInProfile() {
    return window.location.pathname.startsWith('/in/') ||
           window.location.href.includes('linkedin.com/in/') ||
           window.location.href.includes('mock-linkedin');
  }

  function findActionTarget() {
    // Stage 1: Explicit known LinkedIn action bar selectors
    const actionRowSelectors = [
      '.pvs-profile-actions',
      '.pv-top-card-v2-ctas',
      'div[class*="pv-top-card"] [class*="action"]',
      'div.ph5 div.display-flex.mt2',
      'div.ph5 div.display-flex.align-items-center',
      'div.pv-top-card--list'
    ];

    for (const sel of actionRowSelectors) {
      try {
        const el = document.querySelector(sel);
        if (el && el.querySelectorAll('button').length > 0) {
          const moreBtn = el.querySelector('button[aria-label*="More"], button[aria-label*="more"], .artdeco-dropdown');
          return { container: el, refNode: moreBtn || null };
        }
      } catch (e) {}
    }

    // Stage 2: Target action buttons in the profile top-card
    // Works on prospect profiles (Message, Connect, Follow) and own profile (Open to, Add section, Enhance profile)
    const topCard = document.querySelector('main section.artdeco-card:first-of-type, section.artdeco-card:first-of-type, .pv-top-card, main') || document.body;
    const buttons = Array.from(topCard.querySelectorAll('button'));

    const actionKeywords = [
      'message', 'connect', 'follow', 'open to',
      'add section', 'add profile section', 'enhance profile', 'pending'
    ];

    let matchedBtn = null;
    let overflowBtn = null;

    for (const btn of buttons) {
      const text = (btn.innerText || '').trim().toLowerCase();
      const aria = (btn.getAttribute('aria-label') || '').trim().toLowerCase();

      // Check for action button match
      for (const kw of actionKeywords) {
        if (text.includes(kw) || aria.includes(kw)) {
          matchedBtn = btn;
          break;
        }
      }

      // Check for More / ... button
      if (text === '...' || aria.includes('more actions') || aria.includes('more profile actions')) {
        overflowBtn = btn;
      }
    }

    if (matchedBtn) {
      // Find the row container of this button
      const container = matchedBtn.closest('div.display-flex') || matchedBtn.parentElement;
      // If overflowBtn exists in the same row, insert right before it; otherwise after matchedBtn
      const refNode = (overflowBtn && overflowBtn.parentElement === container) ? overflowBtn : matchedBtn.nextSibling;
      return { container, refNode };
    }

    if (overflowBtn) {
      return { container: overflowBtn.parentElement, refNode: overflowBtn };
    }

    // Stage 3: Look for any button with class artdeco-button inside .ph5 or top card
    const artdecoBtns = Array.from(document.querySelectorAll('.ph5 button.artdeco-button, .pv-top-card button.artdeco-button'));
    if (artdecoBtns.length > 0) {
      const lastBtn = artdecoBtns[artdecoBtns.length - 1];
      return { container: lastBtn.parentElement, refNode: lastBtn.nextSibling };
    }

    return null;
  }

  function injectButton() {
    if (!isLinkedInProfile()) return;

    // Remove any floating button at the bottom so it doesn't overlap LinkedIn messaging
    const oldFloat = document.querySelector('#colddm-floating-btn');
    if (oldFloat) oldFloat.remove();

    // Check if already injected and still connected in DOM
    const existing = document.querySelector('#colddm-btn-injected');
    if (existing && document.body.contains(existing)) {
      return;
    }

    const target = findActionTarget();
    if (!target || !target.container) {
      return;
    }

    const btn = document.createElement('button');
    btn.id = 'colddm-btn-injected';
    btn.className = 'colddm-inject-btn';
    btn.setAttribute('type', 'button');
    btn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 20h9"/>
        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
      </svg>
      <span>Write Icebreaker</span>
    `;
    btn.title = 'Draft personalized outreach with ColdDM';

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      handleTriggerClick();
    });

    if (target.refNode && target.refNode.parentElement === target.container) {
      target.container.insertBefore(btn, target.refNode);
    } else {
      target.container.appendChild(btn);
    }
  }

  /* ==========================================================================
     4. Modal Overlay Component
     ========================================================================== */

  function getInitials(name) {
    if (!name || name === 'Prospect') return 'DM';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  function createModalRoot() {
    let overlay = document.querySelector('#colddm-overlay-root');
    if (overlay) return overlay;

    overlay = document.createElement('div');
    overlay.id = 'colddm-overlay-root';
    overlay.innerHTML = `
      <div class="colddm-modal" id="colddm-modal-box">
        <div class="colddm-modal-header">
          <div class="colddm-header-left">
            <div class="colddm-avatar-badge" id="colddm-modal-initials">SC</div>
            <div class="colddm-title-box">
              <h3 id="colddm-modal-name">Draft Outreach Messages</h3>
              <p id="colddm-modal-headline">Loading prospect data...</p>
            </div>
          </div>
          <div class="colddm-header-right">
            <div class="colddm-quota-badge" id="colddm-quota-display">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
              <span id="colddm-quota-text">25 / 25 left</span>
            </div>
            <span class="colddm-kbd">Esc</span>
            <button class="colddm-close-btn" id="colddm-close-x" title="Close (Esc)">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          </div>
        </div>
        <div class="colddm-modal-body" id="colddm-modal-content">
          <!-- Dynamic states injected here: Skeleton, Limit Banner, or Cards -->
        </div>
        <div class="colddm-modal-footer">
          <span class="colddm-footer-meta">Click "Copy" to paste into LinkedIn Connection Note or Message</span>
          <button class="colddm-regen-btn" id="colddm-regen-button">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
            </svg>
            <span>Regenerate Drafts</span>
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    // Event listeners
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        closeModal();
      }
    });

    overlay.querySelector('#colddm-close-x').addEventListener('click', closeModal);

    overlay.querySelector('#colddm-regen-button').addEventListener('click', () => {
      if (!isGenerating) {
        generateIcebreakers(true);
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && overlay.classList.contains('colddm-visible')) {
        closeModal();
      }
    });

    return overlay;
  }

  function openModal() {
    const overlay = createModalRoot();
    overlay.classList.add('colddm-visible');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    const overlay = document.querySelector('#colddm-overlay-root');
    if (overlay) {
      overlay.classList.remove('colddm-visible');
    }
    document.body.style.overflow = '';
  }

  function renderSkeletonLoader() {
    const content = document.querySelector('#colddm-modal-content');
    if (!content) return;

    content.innerHTML = `
      <div class="colddm-skeleton-container">
        <div class="colddm-skeleton-loading-text">
          <div class="colddm-spinner"></div>
          <span>Analyzing prospect profile and drafting 3 unique angles...</span>
        </div>
        <div class="colddm-skeleton-card">
          <div class="colddm-shimmer colddm-skeleton-pill"></div>
          <div class="colddm-shimmer colddm-skeleton-line"></div>
          <div class="colddm-shimmer colddm-skeleton-line short"></div>
        </div>
        <div class="colddm-skeleton-card">
          <div class="colddm-shimmer colddm-skeleton-pill"></div>
          <div class="colddm-shimmer colddm-skeleton-line"></div>
          <div class="colddm-shimmer colddm-skeleton-line short"></div>
        </div>
        <div class="colddm-skeleton-card">
          <div class="colddm-shimmer colddm-skeleton-pill"></div>
          <div class="colddm-shimmer colddm-skeleton-line"></div>
          <div class="colddm-shimmer colddm-skeleton-line short"></div>
        </div>
      </div>
    `;
  }

  function renderLimitReachedBanner() {
    const content = document.querySelector('#colddm-modal-content');
    const regenBtn = document.querySelector('#colddm-regen-button');
    if (regenBtn) regenBtn.disabled = true;

    if (!content) return;
    content.innerHTML = `
      <div class="colddm-limit-banner">
        <strong>Daily Free Limit Reached (25/25)</strong>
        You have used your 25 daily free generations. Your quota automatically resets tomorrow at midnight.
      </div>
      <p style="text-align: center; color: #64748b; font-size: 12.5px; margin-top: 15px;">
        Tip: Configure a custom API key in the extension popup for unlimited generations.
      </p>
    `;
  }

  function renderError(message) {
    const content = document.querySelector('#colddm-modal-content');
    if (!content) return;

    content.innerHTML = `
      <div class="colddm-error-banner">
        <p><strong>Connection Error</strong></p>
        <p style="margin: 8px 0; font-size: 13px; color: #475569;">${escapeHtml(message)}</p>
        <button id="colddm-retry-btn">Try Again</button>
      </div>
    `;

    content.querySelector('#colddm-retry-btn').addEventListener('click', () => {
      generateIcebreakers(false);
    });
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function updateCharCountPill(textarea, pillEl) {
    const len = textarea.value.length;
    const isConnNote = len <= 300;
    pillEl.innerHTML = `
      <span class="colddm-status-dot ${isConnNote ? '' : 'inmail'}"></span>
      <span>${len} chars • ${isConnNote ? 'Fits Connection Note (<300)' : 'Best for InMail / DM'}</span>
    `;
  }

  function renderIcebreakers(icebreakers) {
    const content = document.querySelector('#colddm-modal-content');
    if (!content) return;

    let html = `<div class="colddm-card-list">`;

    icebreakers.forEach((item, index) => {
      let tagLabel = 'RECENT POST & MILESTONE';
      let tagIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`;

      if (index === 1 || item.id === 'style_problem') {
        tagLabel = 'ROLE & PAIN POINT';
        tagIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="22" y1="12" x2="18" y2="12"/><line x1="6" y1="12" x2="2" y2="12"/><line x1="12" y1="6" x2="12" y2="2"/><line x1="12" y1="22" x2="12" y2="18"/></svg>`;
      } else if (index === 2 || item.id === 'style_casual') {
        tagLabel = 'CASUAL CONVERSATION STARTER';
        tagIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`;
      }

      const initialLen = (item.text || '').length;
      const fitsNote = initialLen <= 300;

      html += `
        <div class="colddm-card" data-index="${index}">
          <div class="colddm-card-header">
            <span class="colddm-card-tag">
              ${tagIcon}
              <span>${tagLabel}</span>
            </span>
            <div class="colddm-card-actions">
              <button class="colddm-copy-btn" data-target="colddm-text-${index}">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
                <span>Copy</span>
              </button>
            </div>
          </div>
          <div class="colddm-text-container">
            <textarea class="colddm-message-textarea" id="colddm-text-${index}" spellcheck="false">${escapeHtml(item.text)}</textarea>
          </div>
          <div class="colddm-card-footer">
            <div class="colddm-char-pill" id="colddm-char-${index}">
              <span class="colddm-status-dot ${fitsNote ? '' : 'inmail'}"></span>
              <span>${initialLen} chars • ${fitsNote ? 'Fits Connection Note (<300)' : 'Best for InMail / DM'}</span>
            </div>
          </div>
          ${item.whyItWorks ? `
            <div class="colddm-why-line">
              <strong>Strategy:</strong> ${escapeHtml(item.whyItWorks)}
            </div>
          ` : ''}
        </div>
      `;
    });

    html += `</div>`;
    content.innerHTML = html;

    // Attach real-time character count listeners
    icebreakers.forEach((_, index) => {
      const textarea = document.getElementById(`colddm-text-${index}`);
      const pill = document.getElementById(`colddm-char-${index}`);
      if (textarea && pill) {
        textarea.addEventListener('input', () => {
          updateCharCountPill(textarea, pill);
        });
      }
    });

    // Attach copy button listeners with instant visual feedback
    const copyBtns = content.querySelectorAll('.colddm-copy-btn');
    copyBtns.forEach((btn) => {
      btn.addEventListener('click', async () => {
        const targetId = btn.getAttribute('data-target');
        const textarea = document.getElementById(targetId);
        if (!textarea) return;

        const textToCopy = textarea.value;
        try {
          await navigator.clipboard.writeText(textToCopy);
          btn.classList.add('copied');
          btn.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            <span>Copied!</span>
          `;
          setTimeout(() => {
            btn.classList.remove('copied');
            btn.innerHTML = `
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
              <span>Copy</span>
            `;
          }, 2000);
        } catch (err) {
          textarea.select();
          document.execCommand('copy');
          btn.innerText = 'Copied!';
          setTimeout(() => { btn.innerText = 'Copy'; }, 2000);
        }
      });
    });
  }

  /* ==========================================================================
     5. Generation Execution & API Call
     ========================================================================== */

  async function updateQuotaHeader() {
    const quotaInfo = await getQuotaInfo();
    const quotaDisplay = document.querySelector('#colddm-quota-display');
    const quotaText = document.querySelector('#colddm-quota-text');
    if (quotaText) {
      quotaText.innerText = `${quotaInfo.remaining} / ${DAILY_QUOTA_LIMIT} left today`;
    }
    if (quotaDisplay) {
      if (quotaInfo.remaining <= 5) {
        quotaDisplay.classList.add('low');
      } else {
        quotaDisplay.classList.remove('low');
      }
    }
    return quotaInfo;
  }

  async function handleTriggerClick() {
    currentProspectData = extractProspectData();
    openModal();

    // Populate header info
    const nameEl = document.querySelector('#colddm-modal-name');
    const headlineEl = document.querySelector('#colddm-modal-headline');
    const initialsEl = document.querySelector('#colddm-modal-initials');

    const prospectName = currentProspectData.name || 'Prospect';
    if (nameEl) nameEl.innerText = `Outreach Drafts for ${prospectName}`;
    if (headlineEl) headlineEl.innerText = currentProspectData.headline || 'LinkedIn Member';
    if (initialsEl) initialsEl.innerText = getInitials(prospectName);

    const quotaInfo = await updateQuotaHeader();
    if (quotaInfo.isExceeded) {
      renderLimitReachedBanner();
      return;
    }

    generateIcebreakers(false);
  }

  async function generateIcebreakers(isRegenerate = false) {
    if (isGenerating) return;

    const quotaInfo = await getQuotaInfo();
    if (quotaInfo.isExceeded) {
      renderLimitReachedBanner();
      return;
    }

    isGenerating = true;
    const regenBtn = document.querySelector('#colddm-regen-button');
    if (regenBtn) {
      regenBtn.disabled = true;
      regenBtn.classList.add('spinning');
    }

    renderSkeletonLoader();

    try {
      const endpoint = `${quotaInfo.backendUrl.replace(/\/+$/, '')}/api/generate`;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: currentProspectData.name,
          headline: currentProspectData.headline,
          about: currentProspectData.about,
          recentPost: currentProspectData.recentPost,
          apiKey: quotaInfo.directKey || undefined
        })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || `HTTP error ${response.status}`);
      }

      // Generation successful: increment daily quota
      await incrementQuotaUsage();
      await updateQuotaHeader();

      renderIcebreakers(data.icebreakers || []);

    } catch (err) {
      console.error('ColdDM Generation error:', err);
      let msg = err.message || 'Failed to connect to ColdDM backend.';
      if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
        msg = `Could not connect to ColdDM backend (${quotaInfo.backendUrl}). Please make sure your backend server is running, or test connection in the ColdDM extension popup.`;
      }
      renderError(msg);
    } finally {
      isGenerating = false;
      if (regenBtn) {
        regenBtn.disabled = false;
        regenBtn.classList.remove('spinning');
      }
    }
  }

  /* ==========================================================================
     6. Initialization & SPA Navigation Watcher
     ========================================================================== */

  function init() {
    // Clean up any old floating trigger if present
    const oldFloat = document.querySelector('#colddm-floating-btn');
    if (oldFloat) oldFloat.remove();

    injectButton();

    // LinkedIn dynamic content loads in stages - retry at key intervals
    setTimeout(injectButton, 300);
    setTimeout(injectButton, 800);
    setTimeout(injectButton, 1500);

    // LinkedIn SPA Navigation Watcher
    let lastUrl = window.location.href;
    const observer = new MutationObserver(() => {
      const url = window.location.href;
      if (url !== lastUrl) {
        lastUrl = url;
        setTimeout(injectButton, 300);
        setTimeout(injectButton, 1000);
      } else {
        // Check if button got removed by LinkedIn re-render
        if (isLinkedInProfile() && !document.querySelector('#colddm-btn-injected')) {
          injectButton();
        }
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    // Periodic check every 1s for resilient injection
    setInterval(() => {
      if (isLinkedInProfile() && !document.querySelector('#colddm-btn-injected')) {
        injectButton();
      }
    }, 1000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
