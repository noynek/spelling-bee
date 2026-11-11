export function redisCredentials() {
  const { UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN, KV_REST_API_URL, KV_REST_API_TOKEN } = process.env;
  if (UPSTASH_REDIS_REST_URL && UPSTASH_REDIS_REST_TOKEN) {
    return {url: UPSTASH_REDIS_REST_URL, token: UPSTASH_REDIS_REST_TOKEN};
  }
  if (KV_REST_API_URL && KV_REST_API_TOKEN) return {url: KV_REST_API_URL, token: KV_REST_API_TOKEN};
  return {url: KV_REST_API_URL || UPSTASH_REDIS_REST_URL, token: KV_REST_API_TOKEN || UPSTASH_REDIS_REST_TOKEN, incomplete: true};
}

// Check and increment in one Redis operation across all server instances.
const reserveScript = `
local current = tonumber(redis.call('GET', KEYS[1]) or '0')
local amount = tonumber(ARGV[1])
if current + amount > tonumber(ARGV[2]) then return 0 end
redis.call('INCRBY', KEYS[1], amount)
if current == 0 then redis.call('EXPIRE', KEYS[1], ARGV[3]) end
return 1
`;

export async function reserve(key: string, amount: number, limit: number, seconds: number) {
  const {url, token, incomplete} = redisCredentials();
  if (!url && !token && process.env.VERCEL !== '1') return true;
  if (!url || !token || incomplete) throw new Error('Shared limit store is unavailable');

  const response = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(['EVAL', reserveScript, 1, 'spelling-bee:' + key, amount, limit, seconds]),
    signal: AbortSignal.timeout(4000),
    cache: 'no-store',
  });
  if (!response.ok) throw new Error('Shared limit store is unavailable');
  const { result } = await response.json();
  if (result !== 0 && result !== 1) throw new Error('Invalid shared limit response');
  return result === 1;
}

export async function speechQuota(amount = 1) {
  // Preserve unconfigured local use. Hosted paid requests require a shared store.
  const day = new Date().toISOString().slice(0, 10);
  const limit = Number(process.env.SPEECH_DAILY_LIMIT ?? '500');
  if (!Number.isSafeInteger(limit) || limit < 1) return Response.json({error:'Speech usage limit is misconfigured.'}, {status:503});
  try {
    if (await reserve('speech:' + day, amount, limit, 86_400)) return;
    return Response.json({error:'The daily speech limit was reached. You can continue by typing.'}, {status:429});
  } catch {
    return Response.json({error:'Speech is temporarily unavailable.'}, {status:503});
  }
}
