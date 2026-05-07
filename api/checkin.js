const APPS_SCRIPT_URL =
  process.env.APPS_SCRIPT_URL ||
  'https://script.google.com/macros/s/AKfycbzvWomI7-VHp3fdQ0Q4gZysGa3e3QNQCaOjrJIYXGsRzt9emaaDQH65UeYT0CC-BUUM/exec';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function sendJson(res, statusCode, payload) {
  res.status(statusCode);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.send(JSON.stringify(payload));
}

function trimMessage(value, maxLength = 300) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  return text.length > maxLength ? text.slice(0, maxLength) + '...' : text;
}

async function postToAppsScript(payload) {
  const initialResponse = await fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    body: JSON.stringify(payload),
    redirect: 'manual'
  });

  const location = initialResponse.headers.get('location');

  // Apps Script commonly answers POST requests with a redirect to the
  // googleusercontent URL that holds the actual response body.
  if (location && initialResponse.status >= 300 && initialResponse.status < 400) {
    return fetch(location, {
      method: 'GET',
      redirect: 'follow'
    });
  }

  return initialResponse;
}

function validatePayload(data) {
  const errors = [];

  if (!data || typeof data !== 'object') {
    errors.push('Request body must be a JSON object');
    return errors;
  }

  if (!String(data.firstName || '').trim()) errors.push('firstName is required');
  if (!String(data.lastName || '').trim()) errors.push('lastName is required');
  if (!String(data.company || '').trim()) errors.push('company is required');
  if (!String(data.hostName || '').trim()) errors.push('hostName is required');
  if (!String(data.visitDate || '').trim()) errors.push('visitDate is required');

  const email = String(data.email || '').trim();
  if (!email) {
    errors.push('email is required');
  } else if (!EMAIL_RE.test(email)) {
    errors.push('email format is invalid');
  }

  const language = String(data.language || '').trim();
  if (language !== 'en' && language !== 'vi') {
    errors.push('language must be en or vi');
  }

  return errors;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return sendJson(res, 405, { status: 'error', message: 'Method not allowed' });
  }

  if (!APPS_SCRIPT_URL) {
    return sendJson(res, 500, { status: 'error', message: 'Apps Script URL is not configured' });
  }

  let payload;
  try {
    payload = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body;
  } catch (error) {
    return sendJson(res, 400, { status: 'error', message: 'Request body must be valid JSON' });
  }

  const errors = validatePayload(payload);
  if (errors.length > 0) {
    return sendJson(res, 400, { status: 'error', message: errors.join('; ') });
  }

  try {
    const upstream = await postToAppsScript(payload);

    const responseText = await upstream.text();
    let responseJson = null;

    try {
      responseJson = responseText ? JSON.parse(responseText) : null;
    } catch (parseError) {
      responseJson = null;
    }

    if (!upstream.ok) {
      return sendJson(res, 502, {
        status: 'error',
        message:
          (responseJson && responseJson.message) ||
          trimMessage(responseText) ||
          ('Check-in service returned HTTP ' + upstream.status)
      });
    }

    if (!responseJson || responseJson.status !== 'success') {
      return sendJson(res, 502, {
        status: 'error',
        message:
          (responseJson && responseJson.message) ||
          trimMessage(responseText) ||
          'Check-in service did not confirm the submission'
      });
    }

    return sendJson(res, 200, { status: 'success' });
  } catch (error) {
    return sendJson(res, 502, {
      status: 'error',
      message: 'Unable to reach the check-in service'
    });
  }
};
