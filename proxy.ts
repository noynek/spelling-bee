import { NextRequest, NextResponse } from 'next/server';
import { accessMode, sessionCookie, validSession } from './lib/access';

export function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const mode = accessMode();
  if (mode === 'open' || path === '/login' || path === '/api/login') return NextResponse.next();
  if (mode === 'locked' && validSession(request.cookies.get(sessionCookie)?.value)) {
    const response = NextResponse.next();
    response.headers.set('Cache-Control', 'private, no-store');
    return response;
  }

  if (path.startsWith('/api/')) {
    return NextResponse.json({error: mode === 'unconfigured' ? 'Sign-in setup is incomplete.' : 'Sign in to continue.'}, {
      status: mode === 'unconfigured' ? 503 : 401,
      headers: {'Cache-Control': 'no-store'},
    });
  }
  const response = NextResponse.redirect(new URL('/login', request.url));
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

export const config = {
  matcher: ['/((?!_next/static/|_next/image$).*)'],
};
