// background.js (MV3 service worker, ES module)
// Routes messages to backend HTTP handlers.
import { handleMessage } from './background/handlers.js';

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || (message.type !== 'analyze_mr' && message.type !== 'adopt_change' && message.type !== 'describe_mr')) return; // not for us

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);

  async function run() {
    try {
      const result = await handleMessage(message, { signal: controller.signal });
      if (!result) { sendResponse({ ok: false, error: 'Unknown message' }); return; }
      sendResponse(result);
    } catch (err) {
      sendResponse({ ok: false, error: String(err && err.message ? err.message : err) });
    } finally {
      clearTimeout(timeout);
    }
  }

  run();
  return true; // keep channel open
});
