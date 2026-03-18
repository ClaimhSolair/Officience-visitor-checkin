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
