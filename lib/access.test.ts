import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSession, sessionSeconds, validSession } from './access.ts';
import { POST } from '../app/api/login/route.ts';
import { speechQuota } from './shared-limits.ts';
import { env } from './test-env.ts';

test('sessions expire and rotating the shared password invalidates them', t => {
  env(t, 'APP_PASSWORD', 'test phrase');
  env(t, 'APP_SESSION_SECRET', 'test-secret-with-at-least-32-characters');
  const now = 1700000000000;
  const token = createSession(now);
  assert.equal(validSession(token, now), true);
  assert.equal(validSession(token, now + sessionSeconds * 1000), false);
  assert.equal(validSession(token.replace(/^\d+/, '9999999999'), now), false);
  env(t, 'APP_PASSWORD', 'rotated phrase');
  assert.equal(validSession(token, now), false);
});

test('hosted login requires shared rate limit and valid challenge before setting a secure session', async t => {
  for (const [key, value] of Object.entries({
    VERCEL: '1', APP_PASSWORD: 'test phrase', APP_SESSION_SECRET: 'test-secret-with-at-least-32-characters',
    TURNSTILE_SITE_KEY: 'test-site-key', TURNSTILE_SECRET_KEY: 'test-turnstile-secret',
    KV_REST_API_URL: 'https://redis.example', KV_REST_API_TOKEN: 'test-token',
    UPSTASH_REDIS_REST_URL: '', UPSTASH_REDIS_REST_TOKEN: '',
  })) env(t, key, value);

  let remaining = 1;
  let validChallenge = false;
  let challengeRequests = 0;
  t.mock.method(globalThis, 'fetch', async (url: string) => {
    if (url === 'https://redis.example') return Response.json({result: remaining});
    challengeRequests++;
    return Response.json({success: true, action: 'login', hostname: validChallenge ? 'bee.example' : 'other.example'});
  });
  const request = () => new Request('https://bee.example/api/login', {
    method: 'POST',
    headers: {'Content-Type':'application/json', Origin:'https://bee.example'},
    body: JSON.stringify({password:'test phrase',token:'test-token'}),
  });
  assert.equal((await POST(request())).status, 403);
  validChallenge = true;
  const allowed = await POST(request());
  assert.equal(allowed.status, 200);
  const cookie = allowed.headers.get('set-cookie') ?? '';
  for (const flag of ['HttpOnly', 'Secure', 'SameSite=lax']) assert.ok(cookie.includes(flag));
  remaining = 0;
  assert.equal((await POST(request())).status, 429);
  assert.equal(challengeRequests, 2);
});

test('speech quota blocks exhausted usage and unavailable quota storage', async t => {
  env(t, 'VERCEL', '1');
  env(t, 'UPSTASH_REDIS_REST_URL', 'https://redis.example');
  env(t, 'UPSTASH_REDIS_REST_TOKEN', 'test-token');
  let available = true;
  t.mock.method(globalThis, 'fetch', async () => available ? Response.json({result:0}) : new Response(null, {status:503}));
  assert.equal((await speechQuota())?.status, 429);
  available = false;
  assert.equal((await speechQuota())?.status, 503);
});
