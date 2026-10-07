import { readFile } from "node:fs/promises";
import type { Hono } from "hono";
import { CASE_LIBRARY_SOURCES } from "./caseLibrarySources";
import { audit } from "./auditLog";
import { requireConfig, requireUser } from "./auth";
import { caseLibraryImageFile, caseLibraryStatus, startCaseLibrarySync } from "./caseLibrary";

export const CASE_IMAGE_FILE = /^(library-(?:\d+|nbcn-\d+|ym-(?:featured-)?\d+))\.webp$/;

export function registerCaseLibraryRoutes(api: Hono) {
  api.get("/config/case-library", (c) => {
    const denied = requireConfig(c);
    if (denied) return denied;
    return c.json(caseLibraryStatus());
  });

  api.post("/config/case-library/sync", async (c) => {
    const denied = requireConfig(c);
    if (denied) return denied;
    let body: unknown = {};
    const text = await c.req.text();
    try { if (text.trim()) body = JSON.parse(text); }
    catch { return c.json({ error: "Invalid JSON" }, 400); }
    if (!body || typeof body !== "object" || Array.isArray(body)) return c.json({ error: "Invalid body" }, 400);
    const source = (body as { source?: unknown }).source;
    if (source !== undefined && (typeof source !== "string" || !CASE_LIBRARY_SOURCES.some((item) => item.id === source))) return c.json({ error: "Unknown source" }, 400);
    const started = startCaseLibrarySync(source as string | undefined);
    if (started) audit("case_library.sync", { source: source ?? "all" });
    return c.json({ started, status: caseLibraryStatus() }, started ? 202 : 409);
  });

  api.get("/case-library/images/:file", async (c) => {
    if (!(await requireUser(c))) return c.json({ error: "未登录" }, 401);
    const match = CASE_IMAGE_FILE.exec(c.req.param("file") ?? "");
    if (!match) return c.json({ error: "文件不存在" }, 404);
    try {
      const data = await readFile(caseLibraryImageFile(match[1]));
      return new Response(data, { headers: { "Content-Type": "image/webp", "Cache-Control": "private, max-age=86400" } });
    } catch {
      return c.json({ error: "文件不存在" }, 404);
    }
  });
}
