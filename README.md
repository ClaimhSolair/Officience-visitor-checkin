# Officience Visitor Check-In System

A lightweight QR-based visitor check-in system built with static HTML/CSS/JS and Google Sheets as the backend. No server, no framework, no installation required.

---

## How It Works

```
[Kiosk Screen]             [Visitor's Phone]           [Google Sheets]
 index.html           -->   checkin.html           -->  Apps Script
 (language select + QR)     (form, opened via QR)       (private data store)
```

1. A kiosk/tablet displays `index.html` at reception
2. Visitor selects language (Vietnamese or English)
3. A QR code appears on screen
4. Visitor scans the QR with their phone — `checkin.html` opens in their browser
5. Visitor fills in the form and submits
6. Data is written privately to a Google Sheet
7. Visitor is redirected: Vietnamese → [officience.com](https://officience.com) / English → LinkedIn

---

## Files

| File | Description |
|------|-------------|
| `index.html` | Kiosk display page — language selection + QR code generator |
| `checkin.html` | Mobile check-in form — bilingual (EN/VI), Terms modal, submit via Vercel API |
| `api/checkin.js` | Vercel serverless proxy — validates form data and forwards to Google Apps Script |
| `appsscript.gs` | Google Apps Script backend — paste into Apps Script editor |
| `README.md` | This file |

---

## Form Fields

| Field | Required | Notes |
|-------|----------|-------|
| First Name | Yes | |
| Last Name | Yes | |
| Company / Organization | Yes | |
| Who are you here to see? | Yes | |
| Visit Date & Time | Yes | Auto-filled, read-only |
| Email | Yes | Validated format |
| Contact Phone | No | Optional |
| Accept Terms & Policies | Yes | Checkbox with modal popup |

Visitors are identified by **Name + Company** — no ID card required.

---

## Privacy & Security

All visitor data is **write-only from the client side**:

- No data stored on the visitor's device (no localStorage, sessionStorage, or cookies)
- No visitor data echoed back — the server only returns `{ "status": "success" }`
- No GET endpoint — data cannot be queried or retrieved via the web app URL
- The Google Sheet is **private** — accessible only to authorized Officience staff
- Form fields are cleared immediately after submission, before redirect
- No visitor data is logged to the browser console

---

## Deployment Guide (Step by Step — No Coding Experience Required)

### Stage 1 — Set Up Google Sheets (Data Storage)

1. Go to [sheets.google.com](https://sheets.google.com) and create a new blank spreadsheet.
2. Rename it to: `Officience Visitor Log`
3. In the menu bar, click **Extensions → Apps Script**. A code editor opens in a new tab.
4. Delete all existing code in the editor.
5. Open `appsscript.gs` in Notepad, select all (Ctrl+A), copy (Ctrl+C), and paste it into the Apps Script editor.
6. Save (Ctrl+S).
7. Click **Deploy → New Deployment** (top right).
8. In the popup:
   - Click the ⚙️ gear icon → select **Web app**
   - Description: `Visitor Check-In`
   - Execute as: `Me`
   - Who has access: `Anyone`
   - Click **Deploy**
9. When prompted, click **Authorize access** → choose your Google account → click **Allow**.
10. Copy the **Web App URL** that appears (starts with `https://script.google.com/macros/s/...`). You will need this next.

---

### Stage 2 — Connect the Form to Google Sheets

1. Open `checkin.html` in Notepad (right-click → Open with → Notepad).
2. In Vercel, open your project and go to **Settings → Environment Variables**.
3. Add:
   ```txt
   APPS_SCRIPT_URL=https://script.google.com/macros/s/YOUR_ID/exec
   ```
4. Redeploy the site so the serverless function picks up the variable.
5. No change is needed in `checkin.html`; it submits to `/api/checkin` on the same domain.

---

### Stage 3 — Host the Files Online (Free — Netlify)

1. Go to [netlify.com](https://netlify.com) and sign up for a free account.
2. After logging in, scroll down to the drag-and-drop deploy box.
3. Open File Explorer, go to your project folder, select both `index.html` and `checkin.html`.
4. Drag them into the Netlify drop zone. Netlify deploys instantly and gives you a URL like:
   ```
   https://random-name-123.netlify.app
   ```
5. Open `index.html` in Notepad and find:
   ```js
   const CHECKIN_BASE_URL = 'checkin.html';
   ```
   Replace with your full Netlify URL:
   ```js
   const CHECKIN_BASE_URL = 'https://random-name-123.netlify.app/checkin.html';
   ```
6. Save `index.html`, then drag it again into Netlify to update.

> **Optional:** In Netlify → Site configuration → Change site name → set something like `officience-checkin` for a cleaner URL.

---

### Stage 4 — Test Everything

1. Open your Netlify URL on a desktop or tablet (kiosk screen).
2. Select a language — a QR code should appear.
3. Scan the QR with your phone — `checkin.html` opens in the correct language.
4. Fill in the form, accept Terms & Policies, and submit.
5. Open your Google Sheet — the visitor row should appear within seconds.
6. Phone redirects automatically after 3 seconds:
   - Vietnamese → [officience.com](https://officience.com)
   - English → Officience LinkedIn page

---

## Configuration Reference

### `index.html`
```js
const CHECKIN_BASE_URL = 'checkin.html';  // Update to full hosted URL
const RESET_SECONDS = 60;                 // Auto-reset kiosk after N seconds
```

### `checkin.html`
```js
const SUBMIT_URL = '/api/checkin'; // Same-origin Vercel API route
const REDIRECT = {
  vi: 'https://officience.com/',
  en: 'https://www.linkedin.com/company/officience'
};
```

### Vercel environment variable
```txt
APPS_SCRIPT_URL=https://script.google.com/macros/s/YOUR_ID/exec
```

### `appsscript.gs`
```js
const SHEET_NAME = 'Sheet1'; // Change if your Google Sheet tab is renamed
```

---

## Google Sheet Columns

The sheet is auto-created with these columns on the first submission:

| Timestamp | First Name | Last Name | Company | Host (Who to See) | Visit Date & Time | Email | Phone | Language |
|-----------|------------|-----------|---------|-------------------|-------------------|-------|-------|----------|

---

## Tech Stack

| Need | Solution |
|------|----------|
| QR code generation | [qrcode.js](https://github.com/davidshimjs/qrcodejs) via CDN |
| Styling | Inline CSS, mobile-first |
| Backend / data storage | Google Apps Script Web App + Google Sheets |
| Hosting | Netlify (free static hosting) |
| Bilingual support | EN/VI translations embedded in HTML |
| Terms & Policies | Modal popup, bilingual, sourced from company T&C document |

---

## Follow-Up Email Automation (HR)

Each morning, HR finds one Gmail draft per previous-day visitor — pre-filled with the visitor's name, host, visit date, and a Google review link. HR reviews each draft and sends it manually. Nothing is ever auto-sent.

### How it works

- A scheduled function `createFollowUpDrafts()` in `appsscript.gs` runs daily (between 9–10 AM, Google's chosen minute within that window).
- It reads the `Officience Visitor Log` Sheet, finds rows whose `Timestamp` was yesterday, and creates one Gmail draft per row.
- The draft lands in whichever Google account **installed the trigger** — which must be HR's designated email.
- Each drafted row is marked in column **J (`Follow-up Drafted At`)** so it's never re-drafted.

### One-time setup

#### Step 1 — Add the dedup column

Anyone with edit access to the Sheet can do this.

1. Open the Google Sheet.
2. In the header row, add a new column J titled: `Follow-up Drafted At`
3. That's it — leave the column empty.

#### Step 2 — Install the daily trigger

Must be done by HR, from HR's own browser, signed into the HR email account.

1. Open the `Officience Visitor Log` Sheet.
2. Click **Extensions → Apps Script**. The script editor opens.
3. In the left sidebar, click the **clock icon** (Triggers).
4. Click **+ Add Trigger** (bottom right).
5. Configure:
   - **Function to run:** `createFollowUpDrafts`
   - **Deployment:** `Head`
   - **Event source:** `Time-driven`
   - **Type of time-based trigger:** `Day timer`
   - **Time of day:** `9am to 10am`
6. Click **Save**. Google will prompt for permission to access Gmail — click **Authorize** and accept.
7. Done. Drafts will start appearing in HR's Gmail Drafts folder starting the next morning.

### Updating the email copy later

Edit these three constants at the top of the follow-up section in `appsscript.gs`:

```js
const FOLLOWUP_REVIEW_LINK = 'https://g.page/r/...';   // HR's real Google review URL
const FOLLOWUP_SUBJECT     = 'Thank you for visiting Officience';
const FOLLOWUP_TEMPLATE_EN = '...body text with {{firstName}}, {{hostName}}, {{visitDate}}, {{reviewLink}} placeholders...';
```

Save the script. No redeploy or trigger reinstall needed — the next scheduled run uses the new copy.

### Handover when HR changes

The trigger runs as the Google account that **installed it**. If the original HR person leaves and their account is suspended, the trigger silently stops firing.

**Before the old HR account is suspended:** the incoming HR must repeat **Step 2** above from their own browser (signed into the new HR account). This installs a fresh trigger under the new account. Delete the old trigger afterwards from the Triggers panel.

### Known limitations

- Trigger fires within a ~1-hour window — expected and acceptable.
- No tracking of whether HR actually sent the draft — only draft creation is recorded.
- Follow-up emails are English-only. HR translates to Vietnamese manually in the draft if needed.
- If a visitor typos their email at check-in, the draft still gets created; HR will see the bounce after sending.
