// Centralized backend configuration
export const BACKEND_BASE = 'http://kubernetes.docker.internal:8080';
export const ANALYZE_PATH = '/api/v1/mr/analyze';
export const DESCRIBE_PATH = '/api/v1/mr/describe';
export const ANALYZE_URL = `${BACKEND_BASE}${ANALYZE_PATH}`;
export const DESCRIBE_URL = `${BACKEND_BASE}${DESCRIBE_PATH}`;
export function ADOPT_URL(findingId) {
  return `${BACKEND_BASE}/api/v1/mr/adopt/${encodeURIComponent(findingId)}`;
}
