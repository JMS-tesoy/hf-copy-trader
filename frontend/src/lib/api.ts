// Use relative /api so requests go through the Next.js proxy (next.config.ts rewrites).
// This ensures cookies are scoped to the frontend origin and visible to middleware.
// Set NEXT_PUBLIC_API_URL for production deployments without a local proxy.
const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';
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

/** Fetch with credentials included (sends JWT cookie automatically) */
export function withCredentials(): RequestInit {
  return { credentials: 'include' };
}
