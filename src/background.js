// background.js (MV3 service worker, ES module)
// Handles cross-origin fetch to localhost backend to avoid CORS issues from content scripts.
import { ANALYZE_URL, ADOPT_URL, DESCRIBE_URL } from './config.js';

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || (message.type !== 'analyze_mr' && message.type !== 'adopt_change' && message.type !== 'describe_mr')) return; // not for us

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);

  async function handle() {
    try {
      if (message.type === 'analyze_mr') {
        const { mrUrl } = message;
        if (!mrUrl) throw new Error('Missing mrUrl');
        const r = await fetch(ANALYZE_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mr_url: mrUrl }),
          signal: controller.signal,
        });
        const contentType = r.headers.get('content-type') || '';
        if (!r.ok) {
          const text = contentType.includes('application/json') ? JSON.stringify(await r.json()).slice(0, 2000) : (await r.text()).slice(0, 2000);
          sendResponse({ ok: false, error: `HTTP ${r.status}: ${text}` });
          return;
        }
        const data = await r.json();
        sendResponse({ ok: true, data });
      } else if (message.type === 'adopt_change') {
        const { findingId } = message;
        if (!findingId) throw new Error('Missing findingId');
        const r = await fetch(ADOPT_URL(findingId), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
        });
        const contentType = r.headers.get('content-type') || '';
        if (!r.ok) {
          const text = contentType.includes('application/json') ? JSON.stringify(await r.json()).slice(0, 2000) : (await r.text()).slice(0, 2000);
          sendResponse({ ok: false, error: `HTTP ${r.status}: ${text}` });
          return;
        }
        let data;
        if (contentType.includes('application/json')) data = await r.json();
        else data = { status: 'ok', body: await r.text() };
        sendResponse({ ok: true, data });
      } else if (message.type === 'describe_mr') {
        const { mrNewUrl } = message;
        if (!mrNewUrl) throw new Error('Missing mrNewUrl');
        const r = await fetch(DESCRIBE_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mr_new_url: mrNewUrl }),
          signal: controller.signal,
        });
        const contentType = r.headers.get('content-type') || '';
        if (!r.ok) {
          const text = contentType.includes('application/json') ? JSON.stringify(await r.json()).slice(0, 2000) : (await r.text()).slice(0, 2000);
          sendResponse({ ok: false, error: `HTTP ${r.status}: ${text}` });
          return;
        }
        const data = await r.json();
        sendResponse({ ok: true, data });
      }
    } catch (err) {
      sendResponse({ ok: false, error: String(err && err.message ? err.message : err) });
    } finally {
      clearTimeout(timeout);
    }
  }

  handle();
  return true; // keep channel open
});
