import type { Hono } from "hono";
import { requireConfig, requireUser } from "./auth";
import { audit } from "./auditLog";
import { appDb, getAll, run } from "./db";
import { getTier, listTiers, tierInputSchema, usageSummary } from "./userTiers";
import { makeId, now } from "./utils";

export function registerUserTierRoutes(api: Hono) {
  api.get("/me/usage", async c => {
    const user = await requireUser(c);
    return user ? c.json(usageSummary(user.id)) : c.json({ error: "请先登录" }, 401);
  });
  api.get("/config/users/usage", c => {
    const blocked = requireConfig(c); if (blocked) return blocked;
    const days = Number(c.req.query("days") ?? 7);
    if (!Number.isInteger(days) || days < 1 || days > 366) return c.json({ error: "统计天数必须为 1–366 的整数" }, 400);
    return c.json({ users: getAll<{ id: string }>(appDb, "select id from users order by created_at, id").map(user => ({ userId: user.id, ...usageSummary(user.id, days) })) });
  });
  const prefix = "/config/user-tiers";
  api.get(prefix, c => requireConfig(c) ?? c.json({ tiers: listTiers() }));
  for (const method of ["post", "patch"] as const) {
    api[method](method === "post" ? prefix : prefix + "/:id", async c => {
      const blocked = requireConfig(c); if (blocked) return blocked;
      const id = method === "post" ? makeId("tier") : c.req.param("id")!;
      const current = method === "patch" ? getTier(id) : null;
      if (method === "patch" && !current) return c.json({ error: "用户等级不存在" }, 404);
      const input = await c.req.json().catch(() => null);
      if (!input || typeof input !== "object" || Array.isArray(input) || !Object.keys(input).length) return c.json({ error: "等级字段无效" }, 400);
      const base = current ? (({ id, createdAt, updatedAt, ...fields }) => fields)(current) : {};
      const parsed = tierInputSchema.safeParse({ ...base, ...input });
      if (!parsed.success) return c.json({ error: "等级字段无效", issues: parsed.error.issues.map(issue => ({ field: issue.path.join("."), message: issue.message })) }, 400);
      const next = parsed.data;
      if (current?.isDefault && !next.isDefault) return c.json({ error: "请先将另一个等级设为默认等级" }, 400);
      const stamp = now();
      appDb.transaction(() => {
        if (next.isDefault) run(appDb, "update user_tiers set is_default = 0, updated_at = ? where is_default = 1", stamp);
        run(appDb, `insert into user_tiers values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          on conflict(id) do update set name=excluded.name, description=excluded.description,
          allowed_models_json=excluded.allowed_models_json, max_quality=excluded.max_quality,
          daily_image_limit=excluded.daily_image_limit, daily_optimize_limit=excluded.daily_optimize_limit,
          is_default=excluded.is_default, sort_order=excluded.sort_order, updated_at=excluded.updated_at`,
          id, next.name, next.description, JSON.stringify(next.allowedModels), next.maxQuality,
          next.dailyImageLimit, next.dailyOptimizeLimit, Number(next.isDefault), next.sortOrder, current?.createdAt ?? stamp, stamp);
      })();
      audit("user_tier." + (method === "post" ? "create" : "update"), { id, ...next });
      return c.json({ tier: getTier(id) }, method === "post" ? 201 : 200);
    });
  }
  api.delete(prefix + "/:id", c => {
    const blocked = requireConfig(c); if (blocked) return blocked;
    const tier = getTier(c.req.param("id")!);
    if (!tier) return c.json({ error: "用户等级不存在" }, 404);
    if (tier.isDefault) return c.json({ error: "默认等级不可删除" }, 400);
    appDb.transaction(() => {
      run(appDb, "update users set tier_id = (select id from user_tiers where is_default = 1), updated_at = ? where tier_id = ?", now(), tier.id);
      run(appDb, "delete from user_tiers where id = ?", tier.id);
    })();
    audit("user_tier.delete", { id: tier.id, name: tier.name });
    return c.json({ ok: true });
  });
}
