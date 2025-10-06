// Centralized backend configuration
export const BACKEND_BASE = 'https://anythingllm.nationalcloud.ae/r100/git-helper';
export const ANALYZE_PATH = '/api/v1/mr/analyze';
export const ANALYZE_URL = `${BACKEND_BASE}${ANALYZE_PATH}`;
export function ADOPT_URL(findingId) {
  return `${BACKEND_BASE}/api/v1/mr/adopt/${encodeURIComponent(findingId)}`;
}
