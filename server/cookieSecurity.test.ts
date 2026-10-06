import { expect, test } from "bun:test";
import { Hono } from "hono";
import { deleteCookie, setCookie } from "hono/cookie";
import { shouldUseSecureCookie } from "./cookieSecurity";

test.each([
  { url: "http://127.0.0.1/", env: {}, proto: "", secure: false },
  { url: "https://example.test/", env: {}, proto: "", secure: true },
  { url: "http://127.0.0.1/", env: { APP_TRUST_PROXY: "true" }, proto: "https", secure: true },
  { url: "http://127.0.0.1/", env: {}, proto: "https", secure: false },
  { url: "http://127.0.0.1/", env: { APP_TRUST_PROXY: "true" }, proto: "", secure: false },
  { url: "http://127.0.0.1/", env: { APP_COOKIE_SECURE: "true" }, proto: "", secure: true }
])("cookie security: $url, proxy $proto, secure $secure", async ({ url, env, proto, secure }) => {
  const app = new Hono();
  app.get("/", (c) => {
    const options = { path: "/", secure: shouldUseSecureCookie(c, env) };
    setCookie(c, "test_session", "test-value", options);
    deleteCookie(c, "old_session", options);
    return c.text("ok");
  });
  const response = await app.request(url, { headers: { "x-forwarded-proto": proto } });
  const cookies = response.headers.getSetCookie();
  expect(cookies).toHaveLength(2);
  for (const cookie of cookies) expect(cookie.includes("; Secure")).toBe(secure);
});
