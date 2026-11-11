import { redisCredentials } from './shared-limits.ts';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

export const sessionCookie = 'spelling_bee_session';
export const sessionSeconds = 7 * 24 * 60 * 60;

export function accessMode() {
  const hosted = process.env.VERCEL === '1';
  const password = process.env.APP_PASSWORD;
  const speech = process.env.ASSEMBLYAI_API_KEY || process.env.OPENAI_API_KEY || process.env.DEEPGRAM_API_KEY;
  if (!password) return hosted && speech ? 'unconfigured' : 'open';

  const hasTurnstile = Boolean(process.env.TURNSTILE_SITE_KEY && process.env.TURNSTILE_SECRET_KEY);
  const partialTurnstile = Boolean(process.env.TURNSTILE_SITE_KEY || process.env.TURNSTILE_SECRET_KEY);
  const redis = redisCredentials();
  const hasRedis = Boolean(redis.url && redis.token && !redis.incomplete);
  const partialRedis = Boolean(redis.url || redis.token);
  if ((process.env.APP_SESSION_SECRET?.length ?? 0) < 32 ||
      (partialTurnstile && !hasTurnstile) || (partialRedis && !hasRedis) ||
      (hosted && (!hasTurnstile || !hasRedis))) return 'unconfigured';
  return 'locked';
}

export function passwordMatches(input: string) {
  const hash = (value: string) => createHash('sha256').update(value).digest();
  return timingSafeEqual(hash(input), hash(process.env.APP_PASSWORD ?? ''));
}

function signature(expiration: string) {
  return createHmac('sha256', process.env.APP_SESSION_SECRET!)
    .update(JSON.stringify([sessionCookie, expiration, process.env.APP_PASSWORD]))
    .digest('base64url');
}

export function createSession(now = Date.now()) {
  const expiration = String(Math.floor(now / 1000) + sessionSeconds);
  return expiration + '.' + signature(expiration);
}

export function validSession(token?: string, now = Date.now()) {
  if (!token || !process.env.APP_SESSION_SECRET || !process.env.APP_PASSWORD) return false;
  const match = /^(\d{1,12})\.([\w-]{43})$/.exec(token);
  if (!match || Number(match[1]) <= Math.floor(now / 1000)) return false;
  return timingSafeEqual(Buffer.from(match[2]), Buffer.from(signature(match[1])));
}
