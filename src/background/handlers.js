// Message handlers for background worker
import { ANALYZE_URL_FOR, ADOPT_URL_FOR, DESCRIBE_URL_FOR } from '../config.js';
import { postJson } from './http.js';

export async function handleMessage(message, { signal } = {}) {
  if (!message || typeof message !== 'object') return null;

  if (message.type === 'analyze_mr') {
    const { mrUrl } = message;
    if (!mrUrl) throw new Error('Missing mrUrl');
    const url = ANALYZE_URL_FOR(mrUrl);
    return await postJson(url, { mr_url: mrUrl }, { signal });
  }

  if (message.type === 'adopt_change') {
    const { findingId, pageUrl } = message;
    if (!findingId) throw new Error('Missing findingId');
    const url = ADOPT_URL_FOR(findingId, pageUrl || '');
    return await postJson(url, undefined, { signal });
  }

  if (message.type === 'describe_mr') {
    const { mrNewUrl } = message;
    if (!mrNewUrl) throw new Error('Missing mrNewUrl');
    const url = DESCRIBE_URL_FOR(mrNewUrl);
    return await postJson(url, { mr_new_url: mrNewUrl }, { signal });
  }

  return null;
}

