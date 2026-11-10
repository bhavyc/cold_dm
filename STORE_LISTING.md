# Chrome Web Store Submission Listing: ColdDM

Use this dossier when publishing to the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole).

---

## 1. Product Details

- **Extension Name**: `ColdDM - AI LinkedIn Cold DM Personalizer`
- **Short Description** (Max 132 chars):
  > Generate 3 high-converting, personalized cold DM icebreakers directly on LinkedIn profiles with 1 click using Google Gemini.
- **Category**: `Productivity` > `Workflow & Planning`
- **Language**: `English`
- **Version**: `1.0.0`

---

## 2. Detailed Store Description (Copy & Paste)

```markdown
Turn cold LinkedIn prospects into warm conversations with 1 click.

ColdDM reads publicly visible profile data on LinkedIn (Headline, About summary, Recent posts) and crafts 3 human-like, non-spammy cold outreach icebreakers tailored specifically to that person.

━━━━━━━━━━━━━━━━━━━━━━━━━━
🚀 WHY COLD DM PERSONALIZER?
━━━━━━━━━━━━━━━━━━━━━━━━━━

Most LinkedIn messages get ignored because they sound like automated robotic templates:
❌ "Hope this email finds you well..."
❌ "I came across your profile and was impressed..."
❌ "Would love to pick your brain..."

ColdDM eliminates generic corporate fluff. It writes like an experienced peer starting an effortless 1-on-1 dialogue.

━━━━━━━━━━━━━━━━━━━━━━━━━━
✨ 3 TAILORED OUTREACH STYLES
━━━━━━━━━━━━━━━━━━━━━━━━━━

For every prospect, you get 3 distinct hooks:
1. 🎯 Style 1 (Compliment / Recent Post): Anchors on their latest post, company milestone, or career achievement.
2. 💡 Style 2 (Problem / Role Specific): Touches upon a relevant pain point or operational priority in their specific role.
3. ☕ Style 3 (Casual / Quick Starter): A low-friction, peer-to-peer conversation starter that is effortless to reply to.

━━━━━━━━━━━━━━━━━━━━━━━━━━
⭐ KEY FEATURES
━━━━━━━━━━━━━━━━━━━━━━━━━━

• 1-Click Injection: A sleek "Write Icebreaker" button appears directly next to the "Message" or "Connect" button on LinkedIn profile pages.
• Native LinkedIn Design: Zero tacky gradients or distracting overlays. Designed to look and feel like an official LinkedIn workflow.
• Connection Note Validator: Real-time character counter indicates whether your message fits LinkedIn's free 300-character connection request note limit.
• Keyboard Shortcuts: Press 1, 2, or 3 to instantly copy Hook 1, 2, or 3 to your clipboard. Press 'R' to regenerate.
• 25 Free Generations Daily: Generous free quota tracked locally with automatic midnight reset.
• Privacy First & Secure: No LinkedIn account login required. Your Gemini API key is safeguarded on a secure serverless backend and never exposed in the browser.

━━━━━━━━━━━━━━━━━━━━━━━━━━
🔒 PRIVACY & SECURITY
━━━━━━━━━━━━━━━━━━━━━━━━━━

• We do NOT collect or store your LinkedIn login credentials, personal passwords, or private messages.
• ColdDM only reads publicly rendered text on the active profile page when you explicitly click "Write Icebreaker".
• We do not send automated spam messages or scrape mass data (protects your LinkedIn account safety).
• Compliant with Chrome Web Store User Data Privacy Guidelines.

Try ColdDM today and boost your cold outreach reply rates!
```

---

## 3. Privacy & Justification for Chrome Web Store Reviewers

When submitting in the Developer Dashboard, Google requires explanations for requested permissions:

### Single Purpose Description
> "This extension's single purpose is to generate personalized cold outreach icebreakers for LinkedIn profiles based on publicly visible profile context."

### Permissions Justification:
- `storage`:
  > "Used to store the user's daily free generation counter (max 25/day), reset timestamps, and local user preferences on the client device."
- `host_permissions` (`https://*.linkedin.com/*`):
  > "Required to detect when the user is viewing a LinkedIn profile and inject the 'Write Icebreaker' action button next to the profile action bar."

---

## 4. Store Assets Checklist

- [x] **Store Icon**: `extension/icons/icon128.png` (128x128 px)
- [x] **Small Promo Tile**: `store-assets/promo-small-440x280.png` (440x280 px)
- [x] **Marquee Banner**: `store-assets/marquee-1280x800.png` (1280x800 px)
- [x] **Privacy Policy URL / File**: `privacy.html`
- [x] **Submission Zip Package**: `colddm-extension-v1.0.0.zip`

