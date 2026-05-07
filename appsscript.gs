/**
 * Officience Visitor Check-In — Google Apps Script Backend
 * ─────────────────────────────────────────────────────────
 * SETUP INSTRUCTIONS:
 *
 * 1. Go to https://sheets.google.com and create a new spreadsheet.
 *    Name it "Officience Visitor Log" (or anything you prefer).
 *
 * 2. In the spreadsheet, go to Extensions → Apps Script.
 *
 * 3. Delete any existing code in the editor and paste this entire file.
 *
 * 4. Update SHEET_NAME below if you renamed your sheet tab
 *    (default tab name is "Sheet1").
 *
 * 5. Click Save (Ctrl+S), then click Deploy → New Deployment.
 *    - Type: Web App
 *    - Execute as: Me (your Google account)
 *    - Who has access: Anyone
 *    Click Deploy and copy the Web App URL.
 *
 * 6. Paste the Web App URL into checkin.html:
 *    const APPS_SCRIPT_URL = 'YOUR_APPS_SCRIPT_URL_HERE';
 *
 * 7. The spreadsheet will auto-create headers on the first submission.
 *
 * ACCESS CONTROL:
 *    The Google Sheet itself is NOT public. Only you (and people you
 *    explicitly share the Sheet with) can view visitor records.
 *    The Web App only accepts POST requests — there is no way to
 *    query or retrieve data through it.
 */

// ─── CONFIG ───────────────────────────────────────────────────────────────────
const SHEET_NAME = 'Sheet1'; // Change if your tab has a different name
// ─────────────────────────────────────────────────────────────────────────────

const HEADERS = [
  'Timestamp',
  'First Name',
  'Last Name',
  'Company',
  'Host (Who to See)',
  'Visit Date & Time',
  'Email',
  'Phone',
  'Language'
];

/**
 * Handles POST requests from checkin.html.
 * Returns {"status":"success"} — no visitor data is echoed back.
 */
function doPost(e) {
  try {
    const ss    = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAME);

    if (!sheet) {
      return jsonResponse({ status: 'error', message: 'Sheet not found: ' + SHEET_NAME });
    }

    // Auto-create header row if sheet is empty
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(HEADERS);
      sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
      sheet.setFrozenRows(1);
    }

    // Parse incoming JSON body
    const data = JSON.parse(e.postData.contents);

    // ─── SERVER-SIDE VALIDATION ──────────────────────────────────────────
    const errors = validatePayload(data);
    if (errors.length > 0) {
      return jsonResponse({ status: 'error', message: errors.join('; ') });
    }

    // Append row — order must match HEADERS array above
    sheet.appendRow([
      new Date(),                         // Timestamp (server-side)
      sanitize(data.firstName),
      sanitize(data.lastName),
      sanitize(data.company),
      sanitize(data.hostName),
      sanitize(data.visitDate),
      sanitize(data.email),
      sanitize(data.phone  || ''),
      sanitize(data.language)
    ]);

    // Only return success status — no visitor data in response
    return jsonResponse({ status: 'success' });

  } catch (err) {
    return jsonResponse({ status: 'error', message: err.message });
  }
}

/**
 * Handles GET requests — returns a 403 to prevent data browsing.
 */
function doGet() {
  return ContentService
    .createTextOutput(JSON.stringify({ status: 'forbidden' }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Validates required fields and formats in the incoming payload.
 * Returns an array of error messages (empty if valid).
 */
function validatePayload(data) {
  const errors = [];

  if (!data.firstName || !String(data.firstName).trim()) errors.push('firstName is required');
  if (!data.lastName  || !String(data.lastName).trim())  errors.push('lastName is required');
  if (!data.company   || !String(data.company).trim())   errors.push('company is required');
  if (!data.hostName  || !String(data.hostName).trim())  errors.push('hostName is required');
  if (!data.visitDate || !String(data.visitDate).trim())  errors.push('visitDate is required');

  // Email: required + basic format check
  const email = String(data.email || '').trim();
  if (!email) {
    errors.push('email is required');
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    errors.push('email format is invalid');
  }

  // Language must be 'en' or 'vi'
  const lang = String(data.language || '').trim();
  if (lang !== 'en' && lang !== 'vi') {
    errors.push('language must be en or vi');
  }

  return errors;
}

/**
 * Input sanitization — strips whitespace, removes HTML tags,
 * escapes dangerous characters, and limits length.
 */
function sanitize(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .trim()
    .replace(/<[^>]*>/g, '')        // Strip HTML tags
    .replace(/[<>"'`]/g, '')        // Remove dangerous characters
    .substring(0, 500);
}

// ═════════════════════════════════════════════════════════════════════════════
// FOLLOW-UP EMAIL AUTOMATION
// ─────────────────────────────────────────────────────────────────────────────
// Scheduled function that reads yesterday's visitor rows and creates a Gmail
// draft for each one in the inbox of whoever INSTALLED the time-based trigger.
// Drafts are HR-reviewed manually — this script never sends.
//
// SETUP (HR does this once, from HR's own browser, signed in as HR):
//   1. Open the Google Sheet → Extensions → Apps Script
//   2. Click the clock icon (Triggers) in the left sidebar
//   3. Click "+ Add Trigger" (bottom right)
//   4. Configure:
//        Function:       createFollowUpDrafts
//        Deployment:     Head
//        Event source:   Time-driven
//        Type:           Day timer
//        Time of day:    9am to 10am
//   5. Click Save → authorize Gmail access when prompted
//   6. Done. Drafts appear in HR's Gmail Drafts folder each morning.
//
// HANDOVER: If HR leaves the company, the new HR must install the trigger
// under their own account BEFORE the old account is suspended — otherwise
// the trigger silently stops firing.
// ═════════════════════════════════════════════════════════════════════════════

// ─── FOLLOW-UP CONFIG ────────────────────────────────────────────────────────
// TODO: HR to provide final subject, body, and Google review link.
// Swap the three constants below when HR delivers the copy. No other changes needed.

const FOLLOWUP_REVIEW_LINK = 'https://g.page/r/REPLACE_WITH_GOOGLE_REVIEW_LINK';

const FOLLOWUP_SUBJECT = 'Thank you for visiting Officience';

// Placeholders: {{firstName}}, {{hostName}}, {{visitDate}}, {{reviewLink}}
const FOLLOWUP_TEMPLATE_EN =
  'Hi {{firstName}},\n' +
  '\n' +
  'Thank you for visiting Officience on {{visitDate}} to meet {{hostName}}. ' +
  'We hope your visit was a pleasant one.\n' +
  '\n' +
  'We would love to hear your feedback on your experience with us. ' +
  'If you have a moment, a short review on Google would mean a lot:\n' +
  '{{reviewLink}}\n' +
  '\n' +
  'Warm regards,\n' +
  'Officience Team\n' +
  '\n' +
  '---\n' +
  'If you\'d prefer not to receive follow-up emails from us, just reply with STOP ' +
  'and we\'ll remove you from future outreach.';

// 1-indexed column position of the "Follow-up Drafted At" dedup column.
// Must match where you add the column in the Sheet (after "Language" = column J = 10).
const FOLLOWUP_DRAFTED_COL = 10;

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Scheduled entry point. Creates Gmail drafts for yesterday's visitors.
 * Safe to run manually or on a daily time-based trigger.
 */
function createFollowUpDrafts() {
  const ss    = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAME);

  if (!sheet) {
    Logger.log('Follow-up: sheet not found (' + SHEET_NAME + ')');
    return;
  }

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    Logger.log('Follow-up: no data rows');
    return;
  }

  // Ensure the dedup column has a header (one-time setup safety net).
  const headerCell = sheet.getRange(1, FOLLOWUP_DRAFTED_COL);
  if (!headerCell.getValue()) {
    headerCell.setValue('Follow-up Drafted At').setFontWeight('bold');
  }

  // Column indices (1-indexed) matching the HEADERS array in doPost.
  const COL = {
    timestamp: 1,
    firstName: 2,
    lastName:  3,
    company:   4,
    hostName:  5,
    visitDate: 6,
    email:     7,
    phone:     8,
    language:  9,
    drafted:   FOLLOWUP_DRAFTED_COL
  };

  const tz      = Session.getScriptTimeZone();
  const yStart  = yesterdayStart(tz);
  const yEnd    = new Date(yStart.getTime() + 24 * 60 * 60 * 1000);
  const yLabel  = Utilities.formatDate(yStart, tz, 'yyyy-MM-dd');

  const range  = sheet.getRange(2, 1, lastRow - 1, FOLLOWUP_DRAFTED_COL);
  const values = range.getValues();

  let drafted = 0;
  let skipped = 0;
  let failed  = 0;

  for (let i = 0; i < values.length; i++) {
    const row = values[i];
    const rowNum = i + 2;

    const ts = row[COL.timestamp - 1];
    if (!(ts instanceof Date)) { skipped++; continue; }
    if (ts < yStart || ts >= yEnd) { skipped++; continue; }

    // Dedup: already drafted
    if (row[COL.drafted - 1]) { skipped++; continue; }

    const email = String(row[COL.email - 1] || '').trim();
    if (!email) { skipped++; continue; }

    const firstName = sanitize(row[COL.firstName - 1]);
    const hostName  = sanitize(row[COL.hostName  - 1]);
    const visitDate = Utilities.formatDate(ts, tz, 'EEEE, MMMM d, yyyy');

    const body = FOLLOWUP_TEMPLATE_EN
      .replace(/\{\{firstName\}\}/g, firstName)
      .replace(/\{\{hostName\}\}/g,  hostName)
      .replace(/\{\{visitDate\}\}/g, visitDate)
      .replace(/\{\{reviewLink\}\}/g, FOLLOWUP_REVIEW_LINK);

    try {
      GmailApp.createDraft(email, FOLLOWUP_SUBJECT, body);
      sheet.getRange(rowNum, COL.drafted).setValue(new Date());
      drafted++;
    } catch (err) {
      Logger.log('Follow-up: createDraft failed for row ' + rowNum + ' (' + email + '): ' + err.message);
      failed++;
    }
  }

  Logger.log(
    'Follow-up for ' + yLabel + ': ' + drafted + ' drafted, ' +
    skipped + ' skipped, ' + failed + ' failed'
  );
}

/**
 * Returns midnight at the start of yesterday in the script's timezone.
 * Uses an ISO-with-offset string so the resulting Date instant is correct
 * regardless of where the script's server runtime happens to be.
 */
function yesterdayStart(tz) {
  const now = new Date();
  // Format "now" in script tz, then build an ISO string for yesterday at 00:00 in that tz.
  const ymd = Utilities.formatDate(now, tz, 'yyyy-MM-dd').split('-');
  const today = new Date(Number(ymd[0]), Number(ymd[1]) - 1, Number(ymd[2]));
  const yesterdayDate = new Date(today.getTime() - 24 * 60 * 60 * 1000);
  const yIso = Utilities.formatDate(yesterdayDate, tz, 'yyyy-MM-dd');
  const offset = Utilities.formatDate(yesterdayDate, tz, 'XXX');
  return new Date(yIso + 'T00:00:00' + offset);
}
