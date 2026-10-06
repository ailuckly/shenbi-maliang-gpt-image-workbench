import { configDb } from "./db";

export function configuredProviderSecrets() {
  const secrets: string[] = [];
  for (const table of ["provider_configs", "prompt_optimizer_providers"]) {
    if (!configDb.query("select 1 from sqlite_master where type='table' and name=?").get(table)) continue;
    const rows = configDb.query(`select api_key_value,api_key_env from ${table}`).all() as Array<{ api_key_value: string; api_key_env: string }>;
    for (const row of rows) secrets.push(row.api_key_value, Bun.env[row.api_key_env] ?? "");
  }
  return [...new Set(secrets.filter(Boolean))].sort((a, b) => b.length - a.length);
}

export function redactProviderSecrets(value: string, additional: string[] = [], secrets = configuredProviderSecrets()) {
  for (const secret of [...secrets, ...additional].filter(Boolean)) {
    for (const form of [secret, JSON.stringify(secret).slice(1, -1), encodeURIComponent(secret)]) value = value.replaceAll(form, "[redacted]");
  }
  return value;
}

export function redactProviderJson(value: unknown, secrets = configuredProviderSecrets()): unknown {
  if (typeof value === "string") return redactProviderSecrets(value, [], secrets);
  if (Array.isArray(value)) return value.map(item => redactProviderJson(item, secrets));
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, redactProviderJson(item, secrets)]));
  return value;
}
