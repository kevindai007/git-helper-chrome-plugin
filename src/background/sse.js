// sse.js
// POST-based SSE stream for MR Describe, with per-tab delivery of events.

import { DESCRIBE_URL_FOR } from '../config.js';

const activeStreams = new Map(); // correlationId -> { controller, tabId }

function genId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function abortMrDescribe(correlationId) {
  const it = activeStreams.get(correlationId);
  if (it) {
    try { it.controller.abort(); } catch {}
    activeStreams.delete(correlationId);
  }
}

export async function startMrDescribe({ tabId, mrNewUrl }) {
  const correlationId = genId();
  const controller = new AbortController();
  activeStreams.set(correlationId, { controller, tabId });

  const url = DESCRIBE_URL_FOR(mrNewUrl);
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
        'Cache-Control': 'no-cache',
      },
      body: JSON.stringify({ mr_new_url: mrNewUrl }),
      signal: controller.signal,
    });

    if (!r.ok) {
      const msg = `HTTP ${r.status}`;
      notify(tabId, {
        type: 'describe_mr_event',
        correlationId,
        eventType: 'error',
        data: { message: msg, ts: new Date().toISOString(), correlationId },
      });
      activeStreams.delete(correlationId);
      return correlationId;
    }

    const reader = r.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let idx;
      while ((idx = buffer.indexOf('\n\n')) >= 0) {
        const chunk = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        handleSseChunk(tabId, correlationId, chunk);
      }
    }

    // Flush remaining buffer if it has a full frame
    if (buffer.trim()) handleSseChunk(tabId, correlationId, buffer);
  } catch (err) {
    if (controller.signal.aborted) {
      // Silent abort
    } else {
      notify(tabId, {
        type: 'describe_mr_event',
        correlationId,
        eventType: 'error',
        data: { message: String(err && err.message ? err.message : err), ts: new Date().toISOString(), correlationId },
      });
    }
  } finally {
    activeStreams.delete(correlationId);
  }

  return correlationId;
}

function handleSseChunk(tabId, correlationId, frame) {
  // Parse event: and data: lines (can be multiple data lines)
  const lines = frame.split(/\r?\n/);
  let eventType = 'message';
  const dataLines = [];
  for (const line of lines) {
    if (line.startsWith('event:')) {
      eventType = line.slice(6).trim();
    } else if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).trimStart());
    }
  }
  const rawData = dataLines.join('\n');
  let data = rawData;
  if (eventType === 'start' || eventType === 'error' || eventType === 'done') {
    try { data = rawData ? JSON.parse(rawData) : {}; } catch { data = { message: rawData }; }
  } else if (eventType === 'delta') {
    // Some servers may JSON-encode delta text; try to parse then fallback
    try {
      const parsed = JSON.parse(rawData);
      if (typeof parsed === 'string') data = parsed;
      else if (parsed && typeof parsed.text === 'string') data = parsed.text;
      else data = rawData;
    } catch {
      data = rawData;
    }
  }

  notify(tabId, { type: 'describe_mr_event', correlationId, eventType, data });
}

function notify(tabId, payload) {
  try { chrome.tabs.sendMessage(tabId, payload); } catch {}
}
