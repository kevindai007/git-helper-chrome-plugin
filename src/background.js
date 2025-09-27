// background.js (MV3 service worker)
// Handles cross-origin fetch to localhost backend to avoid CORS issues from content scripts.

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.type !== 'analyze_mr') return; // not for us

  const { mrUrl } = message;
  // Defensive: ensure we have a URL
  if (!mrUrl) {
    sendResponse({ ok: false, error: 'Missing mrUrl' });
    return true;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);

  fetch('http://localhost:8080/api/v1/mr/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mr_url: mrUrl }),
    signal: controller.signal,
  })
    .then(async (r) => {
      clearTimeout(timeout);
      const contentType = r.headers.get('content-type') || '';
      if (!r.ok) {
        const text = contentType.includes('application/json') ? JSON.stringify(await r.json()).slice(0, 2000) : (await r.text()).slice(0, 2000);
        return sendResponse({ ok: false, error: `HTTP ${r.status}: ${text}` });
      }
      const data = await r.json();
      return sendResponse({ ok: true, data });
    })
    .catch((err) => {
      clearTimeout(timeout);
      sendResponse({ ok: false, error: String(err && err.message ? err.message : err) });
    });

  // Return true to keep the message channel open for async sendResponse
  return true;
});

