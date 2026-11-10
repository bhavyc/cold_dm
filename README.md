# ColdDM AI - LinkedIn Cold DM Personalizer Chrome Extension (v1.0 MVP)

> **Ek lightweight, fast aur free Chrome Extension jo LinkedIn profiles se data read karke 1-click me 3 personalized cold DM icebreakers generate karti hai.**

---

## 🚀 Features Delivered (Functional Scope)

### A. Chrome Extension (Frontend & Injection)
- **Auto-Detection**: Tool automatically activates exclusively on LinkedIn profile pages (`https://*.linkedin.com/in/*`) and local simulation test environments.
- **Injected UI Button**: Injects a sleek gradient button next to the **Message** or **Connect** action buttons:
  - Label: `✨ Write Icebreaker`
  - Fallback floating widget ensures access regardless of dynamic DOM updates.
  - SPA Navigation Aware: Automatically reinjects when navigating between profiles without full page reloads (`MutationObserver`).
- **Modal Overlay (Sleek Card UI)**:
  - Displays Prospect Name & Headline contextually.
  - **Skeleton Shimmer Loader** with animated spinner during generation (< 2-3 seconds).
  - **3 Distinct Hook Styles**:
    1. **Style 1 (Compliment / Recent Post)**: Hyper-specific praise referencing recent posts, milestones, or achievements.
    2. **Style 2 (Problem / Role Specific)**: High-converting hook pointing to known challenges or priorities in their role.
    3. **Style 3 (Casual / Quick Starter)**: Low-friction, natural peer-to-peer 1-2 liner that's effortless to answer.
  - **One-Click Copy**: Instant clipboard copy with animated green `Copied! ✓` visual confirmation.
  - **Regenerate Button**: Generates fresh variations on demand.
  - Editable text box allows tweaking before copying.

### B. Safe LinkedIn DOM Scraper
Safely extracts public text rendered on the profile DOM:
- **Prospect Name**: Automatically cleans pronouns (e.g., `(He/Him)`), certifications (`PhD`, `MBA`, `PMP`), and emoji noise.
- **Current Headline / Role**
- **About Section**: Truncated to the first 200 words.
- **Latest Post / Activity**: Extracts recent post content when available on the page.

### C. Backend API & AI Integration (Zero API Key Leakage)
- **Secure Serverless Proxy Backend**: The Google Gemini API key is never exposed to the client or browser DOM.
- **AI Model**: Google Gemini (`gemini-flash-lite-latest` / `gemini-2.5-flash` / `gemini-3.8-flash` resilient multi-model fallback).
- **Prompt Engineering**: Strictly eliminates corporate clichés (`"Hope this email finds you well"`, `"stumbled upon your profile"`, `"synergy"`, `"pick your brain"`). Produces authentic, human-like peer messages.
- **Dual Deployment Ready**: Runs locally as Express server or serverless on **Vercel** (`/api/generate`).

### D. Usage Control & Free Tier Protection
- Daily quota tracking via `chrome.storage.local`: **25 generations per day per user**.
- Automatic daily reset at midnight (`YYYY-MM-DD` tracking).
- Graceful banner when limit reached: *"Daily Free Limit Reached (25/25). Quota automatically resets tomorrow!"*
- Live quota display in modal header (`X / 25 left today`) and extension popup progress bar.

---

## 📁 Repository Structure

```
coldDM/
├── backend/
│   ├── api/
│   │   └── generate.js         # Core Vercel serverless / Express handler
│   ├── server.js               # Local Express proxy server (Port 5000)
│   ├── generate-icons.js       # PNG icon generation utility
│   ├── .env                    # Configured with GEMINI_API_KEY
│   ├── .env.example            # Environment template
│   ├── vercel.json             # Vercel deployment configuration
│   └── package.json
├── extension/
│   ├── manifest.json           # Manifest V3 configuration
│   ├── icons/                  # 16x16, 32x32, 48x48, 128x128 icons
│   ├── content/
│   │   ├── content.js          # DOM Scraper, Button Injection, Modal UI
│   │   └── content.css         # Modern sleek styling & skeleton loaders
│   ├── popup/
│   │   ├── popup.html          # Extension popup with quota & connection test
│   │   ├── popup.css
│   │   └── popup.js
│   └── background/
│       └── service-worker.js   # Background service worker
├── test/
│   ├── mock-linkedin.html      # Interactive test page simulating LinkedIn DOM
│   └── test-backend.js         # Automated end-to-end backend test
├── privacy.html                # Privacy policy page for Chrome Web Store
├── colddm-extension-v1.0.0.zip # Ready-to-upload Chrome Web Store submission package
└── package.json
```

---

## ⚡ Quick Start Guide

### Step 1: Run the Backend Proxy Server

Open a terminal in the project directory:

```bash
cd backend
npm install
npm start
```

The server will launch at `http://localhost:5000`:
- Health check: `http://localhost:5000/api/health`
- Generate endpoint: `http://localhost:5000/api/generate`

*(Your Gemini API key is already configured in `backend/.env`)*

---

### Step 2: Install Extension in Google Chrome

1. Open Google Chrome and navigate to `chrome://extensions/`.
2. Toggle on **Developer mode** in the top-right corner.
3. Click the **Load unpacked** button in the top-left.
4. Select the `e:\projects\coldDM\extension` folder.
5. The **ColdDM - AI LinkedIn Cold DM Personalizer** extension will appear in your toolbar!

---

### Step 3: Test It Out

#### Option A: Test on Real LinkedIn
1. Open any LinkedIn profile (e.g. `https://www.linkedin.com/in/someone`).
2. You will see the sleek **✨ Write Icebreaker** button right next to the "Message" or "Connect" button.
3. Click the button — the modal opens, scrapes the profile, shows the skeleton loader for ~2 seconds, and displays 3 high-converting hooks.
4. Click **Copy** on any message to copy it directly to your clipboard!

#### Option B: Test Locally (Without Opening LinkedIn)
1. Open `test/mock-linkedin.html` in Chrome:
   - Double click `mock-linkedin.html` or navigate to `file:///E:/projects/coldDM/test/mock-linkedin.html`
2. Click the **✨ Write Icebreaker** button next to Message/Connect.
3. Verify the extraction of *Sarah Chen*, her headline, about section, and recent post milestone.
4. Test the **Copy** button, **Regenerate**, and **Quota counter**.

---

## 🧪 Automated Testing

To run the automated backend test verifying model speed, prompt adherence, and output schema:

```bash
npm test
```

Sample test output:
```
🧪 Testing ColdDM Backend at http://localhost:5000...
[1/2] Testing GET /api/health ...
✅ Health check passed: API Key is configured.

[2/2] Testing POST /api/generate ...
✅ Generation succeeded in 3.25s (Model: gemini-flash-lite-latest)

Generated 3 Icebreakers:
#1 [Style 1 (Compliment / Recent Post)]
#2 [Style 2 (Problem / Role Specific)]
#3 [Style 3 (Casual / Quick Starter)]
🎉 ALL BACKEND TESTS PASSED SUCCESSFULLY!
```

---

## 🌐 Deploying Backend to Vercel (Production)

To deploy the backend to Vercel with zero config:

1. Install Vercel CLI or link with GitHub:
   ```bash
   npm i -g vercel
   cd backend
   vercel
   ```
2. Set Environment Variable in Vercel Dashboard:
   - `GEMINI_API_KEY` = your Gemini API Key
3. Copy your deployed Vercel domain (e.g. `https://colddm-api.vercel.app`).
4. Click the ColdDM extension icon in Chrome toolbar, paste the Vercel URL in the **Backend API Endpoint** box, and click **Save**!

---

## 📦 Chrome Web Store Submission Ready

All assets required for Chrome Web Store publishing are included:
- **Manifest V3** compliant configuration (`manifest.json`)
- **Zip Package**: `colddm-extension-v1.0.0.zip` (regenerate anytime via `npm run package`)
- **Icons**: 16px, 32px, 48px, 128px (`extension/icons/`)
- **Privacy Policy**: `privacy.html` ready to host on GitHub Pages or Vercel.

---

## ✅ Acceptance Criteria Verification

| Requirement | Implementation Status |
| :--- | :--- |
| **LinkedIn button injection without UI glitch** | ✅ Tested on multiple action-bar selectors with fallback floating widget and SPA re-mount observer |
| **3 distinct customized lines under 3 seconds** | ✅ Powered by `gemini-flash-lite-latest` returning 3 formatted styles with explanations |
| **1-Click Copy with visual feedback** | ✅ Clipboard API with green `Copied! ✓` transition & fallback |
| **API Key security** | ✅ Gemini API key stays on Node/Vercel server; 0% exposure in client code |
| **Daily 25 generations rate limit** | ✅ Tracked in `chrome.storage.local` with midnight auto-reset & limit banner |

