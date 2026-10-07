import type { Context } from "hono";
import { SESSION_SHARE_CLIENT_IP_HEADER } from "./sessionShareRoutes";

// Brute-force protection for password logins. Failures are counted per client IP and per
// account; once a key reaches its limit it is locked, and every further failure while the
// window is still open doubles the lock (capped). A success clears the account key only, so a
// password-spraying IP stays throttled. State is in memory: a restart resets it, which an
// attacker cannot trigger.

type Bucket = { failures: number; firstAt: number; lockedUntil: number; lockMs: number };

export type LoginLimitPolicy = { maxFailures: number; windowMs: number; lockMs: number; maxLockMs: number };

const MINUTE = 60_000;

export const LOGIN_POLICIES = {
  // Admin (/config) has one shared password, so the IP is the only key; keep it tight.
  configIp: { maxFailures: 5, windowMs: 15 * MINUTE, lockMs: 15 * MINUTE, maxLockMs: 24 * 60 * MINUTE },
  // Distributed guessing against /config across many IPs: lock the admin login as a whole.
  configGlobal: { maxFailures: 50, windowMs: 60 * MINUTE, lockMs: 30 * MINUTE, maxLockMs: 6 * 60 * MINUTE },
  userAccount: { maxFailures: 5, windowMs: 15 * MINUTE, lockMs: 15 * MINUTE, maxLockMs: 24 * 60 * MINUTE },
  userIp: { maxFailures: 20, windowMs: 15 * MINUTE, lockMs: 15 * MINUTE, maxLockMs: 24 * 60 * MINUTE }
} satisfies Record<string, LoginLimitPolicy>;

const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 50_000;

function bucketFor(key: string, at: number, policy: LoginLimitPolicy) {
  const bucket = buckets.get(key);
  if (bucket && (bucket.lockedUntil > at || at - bucket.firstAt < policy.windowMs)) return bucket;
  if (bucket) buckets.delete(key);
  return null;
}

/** Milliseconds the key stays locked, or 0 when attempts are allowed. */
export function loginLockRemaining(key: string, policy: LoginLimitPolicy, at = Date.now()) {
  const bucket = bucketFor(key, at, policy);
  return bucket && bucket.lockedUntil > at ? bucket.lockedUntil - at : 0;
}

export function recordLoginFailure(key: string, policy: LoginLimitPolicy, at = Date.now()) {
  let bucket = bucketFor(key, at, policy);
  if (!bucket) {
    if (buckets.size >= MAX_BUCKETS) pruneLoginBuckets(at);
    bucket = { failures: 0, firstAt: at, lockedUntil: 0, lockMs: 0 };
    buckets.set(key, bucket);
  }
  bucket.failures += 1;
  if (bucket.failures >= policy.maxFailures) {
    bucket.lockMs = bucket.lockMs ? Math.min(bucket.lockMs * 2, policy.maxLockMs) : policy.lockMs;
    bucket.lockedUntil = at + bucket.lockMs;
    // The window restarts when the lock ends, so a failure right after it escalates.
    bucket.firstAt = bucket.lockedUntil;
  }
}

export function clearLoginFailures(key: string) {
  buckets.delete(key);
}

export function pruneLoginBuckets(at = Date.now()) {
  const longestWindow = Math.max(...Object.values(LOGIN_POLICIES).map((policy) => policy.windowMs));
  for (const [key, bucket] of buckets) {
    if (bucket.lockedUntil <= at && at - bucket.firstAt >= longestWindow) buckets.delete(key);
  }
}

export function resetLoginRateLimits() {
  buckets.clear();
}

export function loginClientAddress(c: Context) {
  return c.req.header(SESSION_SHARE_CLIENT_IP_HEADER)?.trim().slice(0, 128) || "unknown";
}

export function loginLockedMessage(remainingMs: number) {
  const minutes = Math.max(1, Math.ceil(remainingMs / MINUTE));
  return `尝试次数过多，请 ${minutes} 分钟后再试`;
}

/** Slows every failed attempt a little; cheap for people, expensive for scripts. */
export function loginFailureDelay() {
  return new Promise((resolve) => setTimeout(resolve, 400 + Math.floor(Math.random() * 300)));
}

setInterval(() => pruneLoginBuckets(), 10 * MINUTE).unref?.();
