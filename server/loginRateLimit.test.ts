import { afterEach, describe, expect, test } from "bun:test";
import { clearLoginFailures, loginLockRemaining, recordLoginFailure, resetLoginRateLimits, type LoginLimitPolicy } from "./loginRateLimit";

const policy: LoginLimitPolicy = { maxFailures: 3, windowMs: 1_000, lockMs: 10_000, maxLockMs: 25_000 };

afterEach(() => resetLoginRateLimits());

describe("login rate limit", () => {
  test("locks after the failure limit and unlocks when the lock expires", () => {
    recordLoginFailure("k", policy, 0);
    recordLoginFailure("k", policy, 100);
    expect(loginLockRemaining("k", policy, 200)).toBe(0);
    recordLoginFailure("k", policy, 200);
    expect(loginLockRemaining("k", policy, 300)).toBe(9_900);
    expect(loginLockRemaining("k", policy, 10_200)).toBe(0);
  });

  test("failures spread beyond the window do not lock", () => {
    recordLoginFailure("k", policy, 0);
    recordLoginFailure("k", policy, 600);
    recordLoginFailure("k", policy, 1_200);
    expect(loginLockRemaining("k", policy, 1_300)).toBe(0);
  });

  test("failing again right after a lock doubles it up to the cap", () => {
    for (const at of [0, 1, 2]) recordLoginFailure("k", policy, at);
    recordLoginFailure("k", policy, 10_003);
    expect(loginLockRemaining("k", policy, 10_003)).toBe(20_000);
    recordLoginFailure("k", policy, 30_004);
    expect(loginLockRemaining("k", policy, 30_004)).toBe(25_000);
  });

  test("clearing a key resets it", () => {
    for (const at of [0, 1, 2]) recordLoginFailure("k", policy, at);
    clearLoginFailures("k");
    expect(loginLockRemaining("k", policy, 3)).toBe(0);
  });
});
