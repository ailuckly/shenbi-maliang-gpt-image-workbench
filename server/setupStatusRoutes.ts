import type { Hono } from "hono";
import { audit } from "./auditLog";
import { requireConfig, requireUser } from "./auth";
import { IMAGE_CATEGORIES, IMAGE_CATEGORY_SOURCE } from "./promptEngine/imageCategories";
import { promptEngineSettings, savePromptEngineSettings } from "./promptEngineSettings";
import { applySetupFix, setupStatus } from "./setupStatus";

export function registerSetupStatusRoutes(api: Hono) {
  api.get("/config/setup-status", (c) => requireConfig(c) ?? c.json(setupStatus()));

  api.post("/config/setup-status/fix", async (c) => {
    const denied = requireConfig(c);
    if (denied) return denied;
    const body = await c.req.json().catch(() => ({})) as { action?: unknown };
    const result = applySetupFix(String(body.action ?? ""));
    if (!result) return c.json({ error: "未知的修复操作" }, 400);
    audit("setup.fix", { action: body.action, changed: result.changed });
    return c.json({ ...result, status: setupStatus() });
  });

  api.get("/config/image-categories", (c) => requireConfig(c) ?? c.json({
    source: IMAGE_CATEGORY_SOURCE,
    categories: IMAGE_CATEGORIES.map((category) => ({
      id: category.id,
      label: category.label,
      // RegExp#source escapes non-ASCII characters in this runtime; show the words as written.
      keywords: category.keywords
        ? category.keywords.source.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex: string) => String.fromCharCode(parseInt(hex, 16))).split("|")
        : [],
      skeleton: category.skeleton,
      pitfalls: category.pitfalls
    }))
  }));

  api.get("/prompt-engine/settings", async (c) => {
    if (!(await requireUser(c))) return c.json({ error: "未登录" }, 401);
    return c.json(promptEngineSettings());
  });

  api.get("/config/prompt-engine/settings", (c) => requireConfig(c) ?? c.json(promptEngineSettings()));

  api.put("/config/prompt-engine/settings", async (c) => {
    const denied = requireConfig(c);
    if (denied) return denied;
    const body = await c.req.json().catch(() => ({})) as { candidateCount?: unknown };
    const saved = savePromptEngineSettings({ candidateCount: body.candidateCount as number | undefined });
    audit("prompt_engine.settings", saved);
    return c.json(saved);
  });
}
