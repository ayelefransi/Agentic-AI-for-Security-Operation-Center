import { NextRequest, NextResponse } from 'next/server';

const PUBLIC_PATHS = ['/', '/login'];
// '/_/' is where Vercel mounts additional services; the backend enforces its own auth there.
const STATIC_PREFIXES = ['/_next', '/favicon.ico', '/api', '/_/'];

function isStaticOrApi(pathname: string): boolean {
  return STATIC_PREFIXES.some((p) => pathname.startsWith(p));
}

async function verifyJwt(token: string, secret: string): Promise<boolean> {
  try {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      enc.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify'],
    );

    const parts = token.split('.');
    if (parts.length !== 3) return false;

    const data = enc.encode(`${parts[0]}.${parts[1]}`);
    const sig = Uint8Array.from(
      atob(parts[2].replace(/-/g, '+').replace(/_/g, '/')),
      (c) => c.charCodeAt(0),
    );

    const valid = await crypto.subtle.verify('HMAC', key, sig, data);
    if (!valid) return false;

    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    if (payload.exp && payload.exp < Date.now() / 1000) return false;

    return true;
  } catch {
    return false;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isStaticOrApi(pathname)) {
    return NextResponse.next();
  }

  const token = request.cookies.get('awra_session')?.value;
  // Must match the backend's signing secret. No fallback: without it every session is rejected.
  const secret = process.env.AWRA_JWT_SECRET || process.env.NEXUS_JWT_SECRET;

  const isAuthenticated = token && secret ? await verifyJwt(token, secret) : false;

  // Signed-in users on / or /login -> dashboard
  if (isAuthenticated && (pathname === '/' || pathname === '/login')) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // Public pages are accessible without auth
  if (PUBLIC_PATHS.includes(pathname)) {
    return NextResponse.next();
  }

  // Everything else requires auth
  if (!isAuthenticated) {
    // Only page navigations get a login redirect. Redirecting a POST makes the
    // browser re-POST to /login, which fails with 405 and hides the real cause.
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return NextResponse.json({ detail: 'Authentication required' }, { status: 401 });
    }
    const from = pathname + request.nextUrl.search;
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('from', from);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};

