import type { Database } from "bun:sqlite";
import { z } from "zod";
import { appDb, getAll, getOne, run, tableColumnExists } from "./db";
import { localTimestamp, now } from "./utils";

export const qualities = ["low", "medium", "high", "xhigh", "max"] as const;
export const tierInputSchema = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().max(2000).default(""),
  allowedModels: z.array(z.string().trim().min(1).max(200)).max(200).default([]),
  maxQuality: z.enum(qualities).default("high"),
  dailyImageLimit: z.number().int().min(0).max(1000000).default(0),
  dailyOptimizeLimit: z.number().int().min(0).max(1000000).default(0),
  isDefault: z.boolean().default(false),
  sortOrder: z.number().int().min(-1000000).max(1000000).default(0)
}).strict();
export type Tier = z.infer<typeof tierInputSchema> & { id: string; createdAt: string; updatedAt: string };
type TierRow = { id: string; name: string; description: string; allowed_models_json: string; max_quality: Tier["maxQuality"]; daily_image_limit: number; daily_optimize_limit: number; is_default: number; sort_order: number; created_at: string; updated_at: string };
export type Usage = { images: number; optimizes: number; checks: number };
export function publicTier(row: TierRow): Tier {
  return { id: row.id, name: row.name, description: row.description, allowedModels: JSON.parse(row.allowed_models_json), maxQuality: row.max_quality, dailyImageLimit: row.daily_image_limit, dailyOptimizeLimit: row.daily_optimize_limit, isDefault: Boolean(row.is_default), sortOrder: row.sort_order, createdAt: row.created_at, updatedAt: row.updated_at };
}
export function migrateUserTiers(db: Database) {
  db.transaction(() => {
    db.run(`create table if not exists user_tiers (
      id text primary key, name text not null, description text not null default '',
      allowed_models_json text not null default '[]',
      max_quality text not null check(max_quality in ('low','medium','high','xhigh','max')),
      daily_image_limit integer not null default 0 check(daily_image_limit >= 0),
      daily_optimize_limit integer not null default 0 check(daily_optimize_limit >= 0),
      is_default integer not null default 0 check(is_default in (0,1)), sort_order integer not null default 0,
      created_at text not null, updated_at text not null
    )`);
    db.run("create unique index if not exists user_tiers_one_default on user_tiers(is_default) where is_default = 1");
    if (!tableColumnExists(db, "users", "tier_id")) db.run("alter table users add column tier_id text references user_tiers(id)");
    db.run(`create table if not exists user_usage_daily (
      user_id text not null references users(id) on delete cascade, day text not null,
      images integer not null default 0 check(images >= 0), optimizes integer not null default 0 check(optimizes >= 0),
      checks integer not null default 0 check(checks >= 0), primary key(user_id, day)
    )`);
    const migration = "user_tiers_20261007";
    if (getOne(db, "select id from app_migrations where id = ?", migration)) return;
    const stamp = now();
    for (const [id, name, models, quality, images, optimizes, order] of [
      ["basic", "基础", '["gpt-image-*"]', "high", 20, 30, 0],
      ["advanced", "高级", "[]", "high", 100, 200, 1],
      ["pro", "专业", "[]", "max", 0, 0, 2]
    ] as const) run(db, "insert into user_tiers values (?, ?, '', ?, ?, ?, ?, ?, ?, ?, ?)", id, name, models, quality, images, optimizes, Number(id === "basic"), order, stamp, stamp);
    run(db, "update users set tier_id = case when has_config_access = 1 then 'pro' else 'basic' end");
    run(db, "insert into app_migrations values (?, ?)", migration, stamp);
  })();
}
export function listTiers() {
  return getAll<TierRow>(appDb, "select * from user_tiers order by sort_order, name, id").map(publicTier);
}
export function getTier(id: string) {
  const row = getOne<TierRow>(appDb, "select * from user_tiers where id = ?", id);
  return row ? publicTier(row) : null;
}
export function tierForUser(userId: string): Tier {
  const user = getOne<{ tier_id: string | null }>(appDb, "select tier_id from users where id = ?", userId);
  if (!user) throw new Error("用户不存在");
  const row = getOne<TierRow>(appDb, "select * from user_tiers where id = ? or is_default = 1 order by (id = ?) desc limit 1", user.tier_id, user.tier_id);
  if (!row) throw new Error("默认用户等级未配置");
  return publicTier(row);
}
function validCount(count: number) {
  if (!Number.isSafeInteger(count) || count < 0) throw new Error("用量必须为非负整数");
}
function todayUsage(userId: string): Usage {
  return getOne<Usage>(appDb, "select images, optimizes, checks from user_usage_daily where user_id = ? and day = ?", userId, localTimestamp().slice(0, 10)) ?? { images: 0, optimizes: 0, checks: 0 };
}
type Allowed = { ok: true } | { ok: false; code: "model" | "quality" | "daily_limit"; message: string };
function dailyAllowed(used: number, requested: number, limit: number, label: string): { ok: true } | { ok: false; code: "daily_limit"; message: string } {
  return limit && requested > limit - used ? { ok: false, code: "daily_limit", message: `今日${label}额度不足（${used}/${limit}，本次需要 ${requested}），请明天再试或联系管理员升级等级` } : { ok: true };
}
export function checkGenerationAllowed(userId: string, { model, quality, count }: { model: string; quality: string; count: number }): Allowed {
  validCount(count);
  const tier = tierForUser(userId);
  const base = model.trim().toLowerCase().split("/").at(-1)!.replace(/^codex-/, "");
  if (tier.allowedModels.length && !tier.allowedModels.some(allowed => allowed === model || (allowed === "gpt-image-*" && /^gpt-image-[a-z0-9]/.test(base)))) return { ok: false, code: "model", message: `「${tier.name}」等级不支持该模型，请联系管理员升级等级` };
  const index = qualities.indexOf((quality === "auto" ? "high" : quality) as Tier["maxQuality"]);
  if (index < 0 || index > qualities.indexOf(tier.maxQuality)) return { ok: false, code: "quality", message: `「${tier.name}」等级最高支持 ${tier.maxQuality} 画质，请降低画质或联系管理员升级等级` };
  return dailyAllowed(todayUsage(userId).images, count, tier.dailyImageLimit, "生图");
}
export function checkOptimizeAllowed(userId: string, calls: number) {
  validCount(calls);
  return dailyAllowed(todayUsage(userId).optimizes, calls, tierForUser(userId).dailyOptimizeLimit, "优化");
}
function recordUsage(userId: string, column: keyof Usage, count: number) {
  validCount(count);
  run(appDb, `insert into user_usage_daily (user_id, day, ${column}) values (?, ?, ?) on conflict(user_id, day) do update set ${column} = ${column} + excluded.${column}`, userId, localTimestamp().slice(0, 10), count);
}
export const recordImageUsage = (userId: string, count: number): void => recordUsage(userId, "images", count);
export const recordOptimizeUsage = (userId: string, calls: number): void => recordUsage(userId, "optimizes", calls);
export const recordCheckUsage = (userId: string, count: number): void => recordUsage(userId, "checks", count);
export function usageSummary(userId: string, days = 7) {
  if (!Number.isInteger(days) || days < 1 || days > 366) throw new Error("统计天数必须为 1–366 的整数");
  const tier = tierForUser(userId);
  const dates = Array.from({ length: days }, (_, index) => {
    const date = new Date(); date.setDate(date.getDate() - (days - 1 - index));
    return localTimestamp(date).slice(0, 10);
  });
  const rows = getAll<Usage & { day: string }>(appDb, "select day, images, optimizes, checks from user_usage_daily where user_id = ? and day between ? and ? order by day", userId, dates[0], dates.at(-1));
  const history = dates.map(day => rows.find(row => row.day === day) ?? { day, images: 0, optimizes: 0, checks: 0 });
  const { images, optimizes, checks } = history.at(-1)!;
  return { tier, today: { images, optimizes, checks }, limits: { dailyImageLimit: tier.dailyImageLimit, dailyOptimizeLimit: tier.dailyOptimizeLimit, allowedModels: tier.allowedModels, maxQuality: tier.maxQuality }, history };
}

/**
 * Counts each saved image once toward the user's daily usage. Completion paths can pass the
 * same ids again (retries, partial batches), so a small ledger de-duplicates them.
 */
export function recordNewImageUsage(userId: string, imageIds: string[]) {
  appDb.run("create table if not exists user_usage_image_ledger (image_id text primary key, user_id text not null, created_at text not null)");
  let added = 0;
  for (const imageId of new Set(imageIds.map((id) => id.trim()).filter(Boolean))) {
    added += run(appDb, "insert or ignore into user_usage_image_ledger (image_id, user_id, created_at) values (?, ?, ?)", imageId, userId, localTimestamp()).changes;
  }
  if (added > 0) recordImageUsage(userId, added);
}
