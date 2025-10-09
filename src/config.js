// Centralized backend configuration
// Default base (fallback if no mapping matches)
export const BACKEND_BASE = 'http://kubernetes.docker.internal:8080';
export const ANALYZE_PATH = '/api/v1/mr/analyze';
export const DESCRIBE_PATH = '/api/v1/mr/describe';

// Host → backend base mapping (adjust as needed)
export const BACKEND_MAP = {
  'gitlab.com': 'http://kubernetes.docker.internal:8080',
  'gitlab-ultimate.nationalcloud.ae': 'https://anythingllm.nationalcloud.ae/r100/git-helper',
};

function hostFromUrl(u) {
  try { return new URL(u).host; } catch { return ''; }
}

export function backendBaseFor(pageUrl) {
  const h = hostFromUrl(pageUrl);
  return (h && BACKEND_MAP[h]) || BACKEND_BASE;
}

export function ANALYZE_URL_FOR(pageUrl) {
  return `${backendBaseFor(pageUrl)}${ANALYZE_PATH}`;
}

export function DESCRIBE_URL_FOR(pageUrl) {
  return `${backendBaseFor(pageUrl)}${DESCRIBE_PATH}`;
}

export function ADOPT_URL_FOR(findingId, pageUrl) {
  return `${backendBaseFor(pageUrl)}/api/v1/mr/adopt/${encodeURIComponent(findingId)}`;
}
