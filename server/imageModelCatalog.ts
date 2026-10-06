import type { Database } from "bun:sqlite";
import { IMAGE_MODEL_IDS } from "../src/lib/imageModels";
import { configDb } from "./db";
import { readProviderModelCatalogCache } from "./providerModelCache";
import { normalizeIdList } from "./utils";
import type { ProviderRow } from "./types";

export function imageModelsForProvider(provider: ProviderRow, db: Database = configDb) {
  const hasCatalogTable = db.query("select name from sqlite_master where type = 'table' and name = 'provider_model_catalogs'").get();
  const catalog = hasCatalogTable ? readProviderModelCatalogCache(db, provider) : null;
  if (catalog) {
    // The configured default also identifies image models with supplier-specific names.
    return [...new Set([...catalog.imageModels, ...(catalog.models.includes(provider.model) ? [provider.model] : [])])];
  }
  return [...new Set([...IMAGE_MODEL_IDS, ...(provider.model ? [provider.model] : [])])];
}

export function providerHasCredentials(provider: ProviderRow) {
  return Boolean(provider.api_key_value || (provider.api_key_env && Bun.env[provider.api_key_env])
    || (provider.channel === "chatgpt_web" && (provider.web_cookies || provider.web_account_id || normalizeIdList(provider.web_account_ids).length > 0)));
}
