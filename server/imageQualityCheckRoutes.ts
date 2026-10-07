import type { Hono } from "hono";
import { requireUser } from "./auth";
import { imageQualityChecksForImages } from "./imageQualityCheck";

export function registerImageQualityCheckRoutes(api: Hono) {
  api.get("/image-quality-checks", async (c) => {
    const user = await requireUser(c);
    if (!user) return c.json({ error: "未登录" }, 401);
    const imageIds = String(c.req.query("imageIds") ?? "").split(",");
    return c.json({ checks: imageQualityChecksForImages(user.id, imageIds) });
  });
}
