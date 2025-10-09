// Lightweight HTTP helpers for background service worker

export async function postJson(url, body, { signal } = {}) {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal,
  });
  const contentType = r.headers.get('content-type') || '';
  if (!r.ok) {
    const text = contentType.includes('application/json')
      ? JSON.stringify(await safeJson(r)).slice(0, 2000)
      : (await r.text()).slice(0, 2000);
    return { ok: false, status: r.status, error: `HTTP ${r.status}: ${text}` };
  }
  if (contentType.includes('application/json')) {
    return { ok: true, status: r.status, data: await r.json() };
  }
  return { ok: true, status: r.status, data: { status: 'ok', body: await r.text() } };
}

async function safeJson(r) {
  try { return await r.json(); } catch { return {}; }
}

