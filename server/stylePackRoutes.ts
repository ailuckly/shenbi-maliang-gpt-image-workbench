import type { Context, Hono } from "hono";
import { z } from "zod";
import { requireConfig, requireUser } from "./auth";
import { audit } from "./auditLog";
import { appDb } from "./db";
import { makeId, now } from "./utils";
import { publicStylePack, stylePackInputSchema, stylePackParamsSchema, visibleStylePack, visibleStylePacks, type StylePackRow } from "./stylePacks";
import { composePrompt } from "./promptEngine/compose";

export function registerStylePackRoutes(api: Hono) {
  for (const admin of [false, true]) {
    const prefix = admin ? "/config/style-packs" : "/style-packs";
    const scope = admin ? "system" : "user";
    const access = async (c: Context) => {
      if (admin) return requireConfig(c) || { owner: null };
      const user = await requireUser(c);
      return user ? { owner: user.id } : c.json({ error: "请先登录" }, 401);
    };
    const owned = (id: string, owner: string | null) => appDb.query<StylePackRow, [string, string, string | null]>(
      "select * from style_packs where id = ? and scope = ? and owner_user_id is ?"
    ).get(id, scope, owner);

    api.get(prefix, async c => {
      const auth = await access(c); if (auth instanceof Response) return auth;
      const rows = admin ? appDb.query<StylePackRow, []>("select * from style_packs where scope = 'system' order by group_key, sort_order, name, id").all()
        : visibleStylePacks(appDb, auth.owner!);
      return c.json({ stylePacks: rows.map(publicStylePack) });
    });

    for (const method of ["post", "patch"] as const) {
      api[method](method === "post" ? prefix : prefix + "/:id", async c => {
        const auth = await access(c); if (auth instanceof Response) return auth;
        const id = method === "post" ? makeId("style") : c.req.param("id") || "";
        const current = method === "patch" ? owned(id, auth.owner) : null;
        if (method === "patch" && !current) return c.json({ error: "风格包不存在或无权修改" }, 404);
        const input = await c.req.json().catch(() => null);
        const schema = method === "post" ? stylePackInputSchema : stylePackInputSchema.partial().refine(value => Object.keys(value).length > 0);
        const parsed = schema.safeParse(input);
        if (!parsed.success) return c.json({ error: "风格包字段无效", issues: parsed.error.issues.map(issue => ({ field: issue.path.join("."), message: issue.message })) }, 400);
        const base = current ? publicStylePack(current) : { groupKey: "", name: "", description: "", optimizeInstruction: "", promptPrefix: "", promptSuffix: "", negativePrompt: "", recommendedParams: {}, sourceNote: "", enabled: true, sortOrder: 0 };
        const next = { ...base, ...parsed.data };
        const timestamp = now();
        appDb.query(`insert into style_packs (
          id, scope, owner_user_id, group_key, name, description, optimize_instruction, prompt_prefix,
          prompt_suffix, negative_prompt, recommended_params_json, source_note, enabled, sort_order, created_at, updated_at
        ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        on conflict(id) do update set group_key=excluded.group_key, name=excluded.name, description=excluded.description,
          optimize_instruction=excluded.optimize_instruction, prompt_prefix=excluded.prompt_prefix, prompt_suffix=excluded.prompt_suffix,
          negative_prompt=excluded.negative_prompt, recommended_params_json=excluded.recommended_params_json,
          source_note=excluded.source_note, enabled=excluded.enabled, sort_order=excluded.sort_order, updated_at=excluded.updated_at`).run(
          id, scope, auth.owner, next.groupKey, next.name, next.description, next.optimizeInstruction, next.promptPrefix,
          next.promptSuffix, next.negativePrompt, JSON.stringify(next.recommendedParams), next.sourceNote, Number(next.enabled), next.sortOrder,
          current?.created_at || timestamp, timestamp
        );
        if (admin) audit("style_pack." + (method === "post" ? "create" : "update"), { id, fields: Object.keys(parsed.data) });
        return c.json({ stylePack: publicStylePack(owned(id, auth.owner)!) }, method === "post" ? 201 : 200);
      });
    }

    api.post(prefix + "/preview", async c => {
      const auth = await access(c); if (auth instanceof Response) return auth;
      const parsed = z.object({
        prompt: z.string().max(30000), negativePrompt: z.string().max(10000).optional(),
        stylePackId: z.string().max(128).optional(), manuallyEdited: z.boolean().optional(),
        stylePack: stylePackInputSchema.optional(),
        userParams: stylePackParamsSchema.optional()
      }).strict().refine(value => !(value.stylePackId && value.stylePack)).safeParse(await c.req.json().catch(() => null));
      if (!parsed.success) return c.json({ error: "预览参数无效" }, 400);
      const row = parsed.data.stylePackId ? (admin ? owned(parsed.data.stylePackId, null) : visibleStylePack(appDb, auth.owner!, parsed.data.stylePackId)) : null;
      if (parsed.data.stylePackId && !row) return c.json({ error: "风格包不存在或不可用" }, 404);
      if (row && !row.enabled && !admin) return c.json({ error: "风格包已停用" }, 400);
      return c.json(composePrompt({ ...parsed.data, stylePack: parsed.data.stylePack || (row ? publicStylePack(row) : null) }));
    });
    if (admin) api.post(prefix + "/:id/move", async c => {
      const auth = await access(c); if (auth instanceof Response) return auth;
      const row = owned(c.req.param("id") || "", null);
      if (!row) return c.json({ error: "风格包不存在" }, 404);
      const parsed = z.object({direction:z.enum(["up","down"])}).strict().safeParse(await c.req.json().catch(()=>null));
      if (!parsed.success) return c.json({error:"排序参数无效"},400);
      appDb.transaction(()=>{
        const rows=appDb.query<StylePackRow,[string]>("select * from style_packs where scope='system' and group_key=? order by sort_order,name,id").all(row.group_key);
        const index=rows.findIndex(pack=>pack.id===row.id), next=index+(parsed.data.direction==="up" ? -1 : 1);
        if(next<0 || next>=rows.length)return;
        [rows[index],rows[next]]=[rows[next],rows[index]];
        const timestamp=now();
        rows.forEach((pack,order)=>appDb.query("update style_packs set sort_order=?,updated_at=? where id=?").run(order,timestamp,pack.id));
      })();
      audit("style_pack.move",{id:row.id,direction:parsed.data.direction});
      return c.json({ok:true});
    });
    api.delete(prefix + "/:id", async c => {
      const auth = await access(c); if (auth instanceof Response) return auth;
      const row = owned(c.req.param("id") || "", auth.owner);
      if (!row) return c.json({ error: "风格包不存在或无权删除" }, 404);
      appDb.query("delete from style_packs where id = ? and scope = ? and owner_user_id is ?").run(row.id, scope, auth.owner);
      if (admin) audit("style_pack.delete", { id: row.id });
      return c.json({ ok: true });
    });
  }
}
