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
    let cleaned = rawName.replace(/\s*\((he\/him|she\/her|they\/them|he\/they|she\/they)[^)]*\)/gi, '');
    cleaned = cleaned.replace(/,\s*(PhD|MBA|PMP|CPA|MD|Esq|MS|BS)\b/gi, '');
    cleaned = cleaned.replace(/([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g, '');
    return cleaned.trim();
  }

  function extractProspectData() {
    let name = '';
    let headline = '';
    let about = '';
    let recentPost = '';

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
        const candidate = cleanProspectName(el.innerText.trim());
        if (candidate && !candidate.toLowerCase().includes('feed') && !candidate.toLowerCase().includes('linkedin')) {
          name = candidate;
          break;
        }
      }
    }

    if (!name && document.title) {
      const parts = document.title.split('|')[0].split('-')[0].trim();
      if (parts && !parts.toLowerCase().includes('linkedin')) {
        name = cleanProspectName(parts);
      }
    }

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

    const aboutSection = document.querySelector('section:has(#about), #about ~ div, section.artdeco-card:has(#about)');
    if (aboutSection) {
      const textEl = aboutSection.querySelector('.inline-show-more-text, .full-width span, .display-flex span');
      if (textEl && textEl.innerText) {
        let rawAbout = textEl.innerText.replace(/\s*\.\.\.see more/i, '').trim();
        const words = rawAbout.split(/\s+/);
        about = words.slice(0, 200).join(' ');
      }
    }

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
     3. Robust Button Injection Logic
     ========================================================================== */

  function isLinkedInProfile() {
    const path = window.location.pathname;
    const href = window.location.href;
    return path.startsWith('/in/') ||
           path.includes('/in/') ||
           href.includes('linkedin.com/in/') ||
           href.includes('mock-linkedin');
  }

  function findActionTarget() {
    // Collect all candidate action buttons and links on the page
    const selectors = [
      'main .artdeco-button',
      '.scaffold-layout__main .artdeco-button',
      '.ph5 .artdeco-button',
      '.pv-top-card .artdeco-button',
      'section.artdeco-card:first-of-type .artdeco-button',
      'main button',
      'main a[role="button"]',
      '.ph5 button',
      '.ph5 a[role="button"]',
      'button.artdeco-button',
      'a.artdeco-button'
    ];

    let candidates = [];
    for (const sel of selectors) {
      const found = Array.from(document.querySelectorAll(sel));
      if (found.length > 0) {
        // Exclude sidebar, navigation, messaging docks
        const filtered = found.filter(el => {
          return !el.closest('header, nav, aside, .scaffold-layout__aside, [class*="aside"], #msg-overlay, .msg-overlay-bubble-header, #global-nav');
        });
        if (filtered.length > 0) {
          candidates = filtered;
          break;
        }
      }
    }

    if (candidates.length === 0) {
      const all = Array.from(document.querySelectorAll('button, a[role="button"], .artdeco-button'));
      candidates = all.filter(el => {
        if (el.closest('header, nav, aside, .scaffold-layout__aside, [class*="aside"], #msg-overlay, .msg-overlay-bubble-header, #global-nav')) {
          return false;
        }
        const t = (el.textContent || el.innerText || '').toLowerCase();
        const a = (el.getAttribute('aria-label') || '').toLowerCase();
        return t.includes('message') || t.includes('connect') || t.includes('open to') || t.includes('enhance profile') || t.includes('add section') || a.includes('more action') || t === '...';
      });
    }

    if (candidates.length === 0) {
      return null;
    }

    // 1. Look for [Message] button -> insert immediately after it
    const msgBtn = candidates.find(b => {
      const t = (b.textContent || b.innerText || '').toLowerCase();
      const a = (b.getAttribute('aria-label') || '').toLowerCase();
      return t.includes('message') || a.includes('message');
    });
    if (msgBtn) {
      const anchor = msgBtn.closest('.artdeco-dropdown') || msgBtn;
      return { anchor, position: 'afterend', label: 'Message button' };
    }

    // 2. Look for [Connect] button -> insert immediately after it
    const connBtn = candidates.find(b => {
      const t = (b.textContent || b.innerText || '').toLowerCase();
      const a = (b.getAttribute('aria-label') || '').toLowerCase();
      return t.includes('connect') || a.includes('connect');
    });
    if (connBtn) {
      const anchor = connBtn.closest('.artdeco-dropdown') || connBtn;
      return { anchor, position: 'afterend', label: 'Connect button' };
    }

    // 3. Look for [Enhance profile] / [Add section] / [Open to] (Own profile)
    const ownBtn = candidates.find(b => {
      const t = (b.textContent || b.innerText || '').toLowerCase();
      const a = (b.getAttribute('aria-label') || '').toLowerCase();
      return t.includes('enhance profile') || t.includes('add section') || t.includes('open to');
    });
    if (ownBtn) {
      const anchor = ownBtn.closest('.artdeco-dropdown') || ownBtn;
      return { anchor, position: 'afterend', label: 'Own profile button' };
    }

    // 4. Look for [...] (More actions) overflow button -> insert right before it
    const moreBtn = candidates.find(b => {
      const t = (b.textContent || b.innerText || '').trim();
      const a = (b.getAttribute('aria-label') || '').toLowerCase();
      return t === '...' || a.includes('more action') || a.includes('more profile action');
    });
    if (moreBtn) {
      const anchor = moreBtn.closest('.artdeco-dropdown') || moreBtn;
      return { anchor, position: 'beforebegin', label: 'More actions button' };
    }

    // 5. Fallback: Take the last action button in the top group
    const lastBtn = candidates[candidates.length - 1];
    const anchor = lastBtn.closest('.artdeco-dropdown') || lastBtn;
    return { anchor, position: 'afterend', label: 'Top-card button fallback' };
  }

  function injectButton() {
    if (!isLinkedInProfile()) return;

    // Remove any floating button
    const oldFloat = document.querySelector('#colddm-floating-btn');
    if (oldFloat) oldFloat.remove();

    // Prevent duplicate injection
    if (document.querySelector('#colddm-btn-injected')) {
      return;
    }

    const target = findActionTarget();
    if (!target || !target.anchor) {
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

    try {
      if (target.position === 'beforebegin') {
        target.anchor.insertAdjacentElement('beforebegin', btn);
      } else {
        target.anchor.insertAdjacentElement('afterend', btn);
      }
      console.log(`%c[ColdDM] ✅ Injected button successfully (${target.label})`, 'color: #0a66c2; font-weight: bold;');
    } catch (err) {
      console.error('[ColdDM] Failed to insert button:', err);
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
            <div class="colddm-avatar-badge" id="colddm-modal-initials">DM</div>
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
          <!-- Dynamic states injected here -->
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
      if (!overlay.classList.contains('colddm-visible')) return;

      if (e.key === 'Escape') {
        closeModal();
        return;
      }

      if (['TEXTAREA', 'INPUT'].includes(document.activeElement?.tagName)) return;

      if (['1', '2', '3'].includes(e.key)) {
        const idx = parseInt(e.key, 10) - 1;
        const btn = overlay.querySelector(`.colddm-copy-btn[data-target="colddm-text-${idx}"]`);
        if (btn) {
          e.preventDefault();
          btn.click();
        }
      } else if (e.key.toLowerCase() === 'r') {
        const regenBtn = overlay.querySelector('#colddm-regen-button');
        if (regenBtn && !regenBtn.disabled) {
          e.preventDefault();
          regenBtn.click();
        }
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
        tagIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="22" y1="12" x2="18" y2="12"/><line x1="6" y1="6" x2="2" y2="12"/><line x1="12" y1="6" x2="12" y2="2"/><line x1="12" y1="22" x2="12" y2="18"/></svg>`;
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

    icebreakers.forEach((_, index) => {
      const textarea = document.getElementById(`colddm-text-${index}`);
      const pill = document.getElementById(`colddm-char-${index}`);
      if (textarea && pill) {
        textarea.addEventListener('input', () => {
          updateCharCountPill(textarea, pill);
        });
      }
    });

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
     6. Initialization & Navigation Watcher
     ========================================================================== */

  function init() {
    console.log('[ColdDM] Content script running on:', window.location.href);

    const oldFloat = document.querySelector('#colddm-floating-btn');
    if (oldFloat) oldFloat.remove();

    injectButton();

    setTimeout(injectButton, 100);
    setTimeout(injectButton, 300);
    setTimeout(injectButton, 600);
    setTimeout(injectButton, 1000);
    setTimeout(injectButton, 1800);
    setTimeout(injectButton, 3000);

    let lastUrl = window.location.href;
    const observer = new MutationObserver(() => {
      const url = window.location.href;
      if (url !== lastUrl) {
        lastUrl = url;
        console.log('[ColdDM] URL changed:', url);
        setTimeout(injectButton, 200);
        setTimeout(injectButton, 800);
      } else {
        if (isLinkedInProfile() && !document.querySelector('#colddm-btn-injected')) {
          injectButton();
        }
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });

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
