import { NextRequest, NextResponse } from 'next/server';

// Decode JWT payload without verification (edge runtime can't use jsonwebtoken)
// Security: actual verification happens on the backend for all API calls
function getJwtPayload(token: string): { role?: string } | null {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = Buffer.from(base64, 'base64').toString('utf8');
    return JSON.parse(json);
  } catch {
    return null;
  }
}

const ADMIN_ROUTES = ['/', '/master', '/user', '/analytics'];
const USER_ROUTES = ['/portal'];
const MASTER_ROUTES = ['/master-portal'];
const PUBLIC_ROUTES = ['/login', '/register', '/master-register'];

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get('auth_token')?.value;
  const payload = token ? getJwtPayload(token) : null;
  const role = payload?.role;

  // Admin routes — must be admin, else send to unified login
  if (ADMIN_ROUTES.some(r => pathname === r || pathname.startsWith(r + '/'))) {
    if (role !== 'admin') {
      return NextResponse.redirect(new URL('/login', req.url));
    }
  }

  // User portal — must be user, else send to unified login
  if (USER_ROUTES.some(r => pathname === r || pathname.startsWith(r + '/'))) {
    if (role !== 'user') {
      return NextResponse.redirect(new URL('/login', req.url));
    }
  }

  // Master portal — must be master, else send to unified login
  if (MASTER_ROUTES.some(r => pathname === r || pathname.startsWith(r + '/'))) {
    if (role !== 'master') {
      return NextResponse.redirect(new URL('/login', req.url));
    }
  }

  // If already authenticated, skip public pages
  if (PUBLIC_ROUTES.includes(pathname)) {
    if (role === 'admin') return NextResponse.redirect(new URL('/', req.url));
    if (role === 'user') return NextResponse.redirect(new URL('/portal', req.url));
    if (role === 'master') return NextResponse.redirect(new URL('/master-portal', req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/', '/master', '/master/:path*', '/user', '/user/:path*',
            '/analytics', '/analytics/:path*', '/portal', '/portal/:path*',
            '/master-portal', '/master-portal/:path*',
            '/login', '/register', '/master-register'],
};
