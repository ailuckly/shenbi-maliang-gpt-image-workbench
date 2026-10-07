import { readFile } from "node:fs/promises";
import type { Hono } from "hono";
import { audit } from "./auditLog";
import { requireConfig, requireUser } from "./auth";
import { caseLibraryImageFile, caseLibraryStatus, startCaseLibrarySync } from "./caseLibrary";

const CASE_IMAGE_FILE = /^(library-\d+)\.webp$/;

export function registerCaseLibraryRoutes(api: Hono) {
  api.get("/config/case-library", (c) => {
    const denied = requireConfig(c);
    if (denied) return denied;
    return c.json(caseLibraryStatus());
  });

  api.post("/config/case-library/sync", (c) => {
    const denied = requireConfig(c);
    if (denied) return denied;
    const started = startCaseLibrarySync();
    if (started) audit("case_library.sync", {});
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
