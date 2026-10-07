import { z } from "zod";
import type { Database } from "bun:sqlite";
import { createHash } from "node:crypto";
import {
  defaultPromptOptimizeStyleGroups, promptOptimizeStyleGroupsToOptions,
  sanitizePromptOptimizeStyleGroups
} from "../src/lib/promptOptimizeStyles";
import { promptOptimizeStyleConfigs, promptOptimizeSubStyleConfigs } from "./promptEngine/legacyStyleConfigs";
import { STYLE_PACK_PRESETS } from "./promptEngine/stylePackPresets";
import { now } from "./utils";

export type StylePackRow = {
  id: string; scope: "system" | "user"; owner_user_id: string | null; group_key: string;
  name: string; description: string; optimize_instruction: string; prompt_prefix: string;
  prompt_suffix: string; negative_prompt: string; recommended_params_json: string;
  source_note: string; enabled: number; sort_order: number; created_at: string; updated_at: string;
};

export function visibleStylePacks(db: Database, userId: string) {
  return db.query<StylePackRow, [string]>(`select * from style_packs
    where (scope = 'system' and enabled = 1) or (scope = 'user' and owner_user_id = ?)
    order by group_key, sort_order, name, id`).all(userId);
}

export function visibleStylePack(db: Database, userId: string, id: string) {
  return db.query<StylePackRow, [string, string]>(`select * from style_packs where id = ?
    and ((scope = 'system' and enabled = 1) or (scope = 'user' and owner_user_id = ?))`).get(id, userId);
}

// Called after users, preferences and app_migrations exist. Both steps are atomic.
export function migrateStylePacks(db: Database, timestamp = now()) {
  db.exec(`create table if not exists style_packs (
    id text primary key,
    scope text not null check(scope in ('system', 'user')),
    owner_user_id text,
    group_key text not null,
    name text not null,
    description text not null default '',
    optimize_instruction text not null default '',
    prompt_prefix text not null default '',
    prompt_suffix text not null default '',
    negative_prompt text not null default '',
    recommended_params_json text not null default '{}',
    source_note text not null default '',
    enabled integer not null default 1 check(enabled in (0, 1)),
    sort_order integer not null default 0,
    created_at text not null,
    updated_at text not null,
    check((scope = 'system' and owner_user_id is null) or (scope = 'user' and owner_user_id is not null)),
    foreign key(owner_user_id) references users(id) on delete cascade
  );
  create index if not exists idx_style_packs_scope_enabled_sort on style_packs(scope, enabled, sort_order);
  create index if not exists idx_style_packs_owner on style_packs(owner_user_id);`);
  const insert = db.query(`insert into style_packs (
    id, scope, owner_user_id, group_key, name, description, optimize_instruction, prompt_prefix,
    prompt_suffix, negative_prompt, recommended_params_json, source_note, enabled, sort_order, created_at, updated_at
  ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '{}', ?, ?, ?, ?, ?)`);
  const defaults = promptOptimizeStyleGroupsToOptions(defaultPromptOptimizeStyleGroups, true);
  db.transaction(() => {
    if (!db.query("select 1 from style_packs limit 1").get()) {
      defaults.forEach((item, order) => {
        const group = item.parentValue || item.value;
        const parent = promptOptimizeStyleConfigs[group];
        const child = promptOptimizeSubStyleConfigs[item.value];
        const instruction = [...(parent?.instructions || []), ...(child?.instructions || [])].join("\n");
        // Existing subStyle keywords distinguish children; general groups stay restrained.
        const prefix = child ? String(child.rules.subStyle || item.label) : (group === "standard" ? "" : item.label + "风格");
        insert.run("system:" + item.value, "system", null, group, item.label, item.description,
          instruction, prefix, "", "", "本项目既有风格：src/lib/promptOptimizeStyles.ts + server/promptEngine/legacyStyleConfigs.ts", 1, order, timestamp, timestamp);
      });
    }
    const migration = "style_packs_user_preferences_v1";
    if (db.query("select id from app_migrations where id = ?").get(migration)) return;
    const preferences = db.query<{user_id: string; prompt_optimize_styles_json: string}, []>(
      "select user_id, prompt_optimize_styles_json from user_preferences where prompt_optimize_styles_json != ''"
    ).all();
    for (const row of preferences) {
      let raw: unknown;
      try { raw = JSON.parse(row.prompt_optimize_styles_json); } catch { continue; }
      if (!Array.isArray(raw)) continue;
      const groups = sanitizePromptOptimizeStyleGroups(raw);
      const options = promptOptimizeStyleGroupsToOptions(groups, true);
      options.forEach((item, order) => {
        const original = defaults.find(option => option.value === item.value);
        const parent = item.parentValue ? groups.find(group => group.value === item.parentValue) : undefined;
        const parentPrompt = parent?.prompt?.trim() || "";
        const enabled = item.visible && parent?.visible !== false;
        if (original && original.label === item.label && original.description === item.description
          && !item.prompt && !parentPrompt && enabled) return;
        const group = item.parentValue || item.value;
        const base = promptOptimizeStyleConfigs[group];
        const child = promptOptimizeSubStyleConfigs[item.value];
        const instruction = [...(base?.instructions || []), ...(child?.instructions || []), parentPrompt, item.prompt].filter(Boolean).join("\n");
        // Deterministic owner-specific IDs avoid collisions and preserve deleted packages after migration.
        const id = "migrated:" + createHash("sha256").update(JSON.stringify([row.user_id, item.value])).digest("hex");
        insert.run(id, "user", row.user_id, group, item.label, item.description, instruction,
          "", "", "", "迁移自 user_preferences.prompt_optimize_styles_json；原条目 " + item.value,
          Number(enabled), order, timestamp, timestamp);
      });
    }
    db.query("insert into app_migrations (id, created_at) values (?, ?)").run(migration, timestamp);
  })();
  upgradeSystemStylePackText(db, timestamp);
}

// v1 seeded keyword prefixes ("commercial product photography"); replace untouched rows with
// descriptive suffixes. Rows an admin already edited keep their text.
function upgradeSystemStylePackText(db: Database, timestamp: string) {
  const migration = "style_packs_presets_v2";
  db.transaction(() => {
    if (db.query("select id from app_migrations where id = ?").get(migration)) return;
    const update = db.query(`update style_packs set prompt_prefix = '', prompt_suffix = ?,
      negative_prompt = case when negative_prompt = '' then ? else negative_prompt end, updated_at = ?
      where id = ? and scope = 'system' and prompt_prefix = ? and prompt_suffix = ''`);
    for (const [id, preset] of Object.entries(STYLE_PACK_PRESETS)) {
      update.run(preset.suffix, preset.negative ?? "", timestamp, id, preset.legacyPrefix);
    }
    db.query("insert into app_migrations (id, created_at) values (?, ?)").run(migration, timestamp);
  })();
}

export const stylePackParamsSchema = z.object({
  aspectRatio: z.string().regex(/^(auto|[1-9]\d{0,2}:[1-9]\d{0,2})$/).optional(),
  quality: z.string().trim().min(1).max(64).optional(),
  n: z.number().int().min(1).max(10).optional()
}).strict();

export function publicStylePack(row: StylePackRow) {
  let recommendedParams = {};
  try {
    const parsed = stylePackParamsSchema.safeParse(JSON.parse(row.recommended_params_json));
    if (parsed.success) recommendedParams = parsed.data;
  } catch { /* Invalid legacy recommendation does not hide the package. */ }
  return {
    id: row.id, scope: row.scope, groupKey: row.group_key, name: row.name, description: row.description,
    optimizeInstruction: row.optimize_instruction, promptPrefix: row.prompt_prefix, promptSuffix: row.prompt_suffix,
    negativePrompt: row.negative_prompt, recommendedParams, sourceNote: row.source_note,
    enabled: Boolean(row.enabled), sortOrder: row.sort_order, createdAt: row.created_at, updatedAt: row.updated_at
  };
}

const instruction = z.string().max(2000);
export const stylePackInputSchema = z.object({
  groupKey: z.string().trim().min(1).max(96), name: z.string().trim().min(1).max(40),
  description: z.string().max(200).optional(), optimizeInstruction: instruction.optional(),
  promptPrefix: instruction.optional(), promptSuffix: instruction.optional(), negativePrompt: instruction.optional(),
  recommendedParams: stylePackParamsSchema.optional(), sourceNote: z.string().max(500).optional(),
  enabled: z.boolean().optional(), sortOrder: z.number().int().min(-100000).max(100000).optional()
}).strict();

