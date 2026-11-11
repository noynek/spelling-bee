import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server.js';
import { accessMode, createSession, passwordMatches, sessionCookie, sessionSeconds } from '../../../lib/access.ts';
import { reserve } from '../../../lib/shared-limits.ts';
import { readLimited, sameOrigin } from '../../../lib/speech-server.ts';

const reply = (error: string, status: number, headers: Record<string, string> = {}) =>
  NextResponse.json({error}, {status, headers: {'Cache-Control': 'no-store', ...headers}});

export async function POST(request: Request) {
  if (!sameOrigin(request)) return reply('Open the sign-in page and try again.', 403);
  if (accessMode() !== 'locked') return reply('Sign-in setup is incomplete.', 503);
  if (!request.headers.get('content-type')?.startsWith('application/json')) return reply('Invalid sign-in request.', 415);

  let input: {password?: unknown; token?: unknown};
  try {
    input = JSON.parse(await (await readLimited(request, 4096, AbortSignal.timeout(5000))).text());
  } catch {
    return reply('Invalid sign-in request.', 400);
  }
  if (!input || typeof input.password !== 'string' || input.password.length > 512) {
    return reply('Enter the shared password.', 400);
  }

  try {
    // Vercel supplies this header at its edge. Other hosts share the fallback bucket.
    const ip = process.env.VERCEL === '1' ? request.headers.get('x-vercel-forwarded-for') : null;
    const key = createHash('sha256').update(ip ?? 'shared').digest('hex');
    if (!await reserve('login:' + key, 1, 5, 600)) {
      return reply('Too many attempts. Try again in ten minutes.', 429, {'Retry-After':'600'});
    }

    const secret = process.env.TURNSTILE_SECRET_KEY;
    if (secret) {
      if (typeof input.token !== 'string' || !input.token || input.token.length > 2048) {
        return reply('Complete the security check and try again.', 400);
      }
      const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        body: new URLSearchParams({secret, response: input.token}),
        signal: AbortSignal.timeout(6000),
        cache: 'no-store',
      });
      if (!response.ok) return reply('Security check is temporarily unavailable.', 503);
      const check = await response.json();
      if (check.success !== true || check.action !== 'login' || check.hostname !== new URL(request.url).hostname) {
        return reply('Complete the security check and try again.', 403);
      }
    }
    if (!passwordMatches(input.password)) return reply('That password didn’t match.', 401);

    const response = NextResponse.json({ok: true}, {headers:{'Cache-Control':'no-store'}});
    response.cookies.set(sessionCookie, createSession(), {
      httpOnly: true,
      secure: process.env.VERCEL === '1' || new URL(request.url).protocol === 'https:',
      sameSite: 'lax',
      path: '/',
      maxAge: sessionSeconds,
    });
    return response;
  } catch {
    return reply('Sign-in is temporarily unavailable. Try again shortly.', 503);
  }
}
