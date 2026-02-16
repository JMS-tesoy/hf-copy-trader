const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
const ADMIN_KEY = process.env.NEXT_PUBLIC_ADMIN_API_KEY || 'changeme-generate-a-real-key';

export const API = `${API_BASE}/api`;

/** Headers for admin-authenticated requests (master CRUD, etc.) */
export function adminHeaders(extra?: Record<string, string>): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'x-api-key': ADMIN_KEY,
    ...extra,
  };
}

/** Headers for read-only requests (no auth needed) */
export function jsonHeaders(): Record<string, string> {
  return { 'Content-Type': 'application/json' };
}
