import type { Context } from "hono";

export function shouldUseSecureCookie(c: Context, environment: Record<string, string | undefined> = Bun.env) {
  const enabled = (value: string | undefined) => ["true", "1", "on"].includes(String(value ?? "").trim().toLowerCase());
  if (enabled(environment.APP_COOKIE_SECURE) || new URL(c.req.url).protocol === "https:") return true;
  return enabled(environment.APP_TRUST_PROXY)
    && String(c.req.header("x-forwarded-proto") ?? "").split(",")[0]?.trim().toLowerCase() === "https";
}
