import { Database } from "bun:sqlite";
import { expect, test } from "bun:test";
import { imageModelsForProvider, providerHasCredentials } from "./imageModelCatalog";
import { writeProviderModelCatalogCache } from "./providerModelCache";
import type { ProviderRow } from "./types";
import { IMAGE_MODEL_IDS, imageModelDisplayName, isImageModelId, isImageQualitySupported } from "../src/lib/imageModels";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

test("supplier catalog is authoritative, invalidated catalogs use documented fallback, no credential means empty UI", () => {
  const db = new Database(":memory:");
  const provider = { id: "catalog-test", model: "supplier-image-model", channel: "api", base_url: "https://example.com", enabled: 1, api_key_env: "", api_key_value: "", web_cookies: "", web_account_id: "", web_account_ids: "[]" } as ProviderRow;
  expect(providerHasCredentials(provider)).toBe(false);
  expect(imageModelsForProvider(provider, db)).toEqual([...IMAGE_MODEL_IDS, provider.model]);
  db.exec(`create table provider_model_catalogs(provider_id text primary key, connection_signature text, endpoint text, duration_ms integer, models_json text, image_models_json text, responses_models_json text, updated_at text)`);
  writeProviderModelCatalogCache(db, provider, { endpoint: "https://example.com/models", durationMs: 1, models: ["supplier-image-model", "supplier-text-model"], imageModels: [], responsesModels: ["supplier-text-model"] });
  expect(imageModelsForProvider(provider, db)).toEqual(["supplier-image-model"]);
  expect(imageModelsForProvider(provider, db)).not.toContain("supplier-text-model");
  expect(imageModelsForProvider({ ...provider, base_url: "https://changed.example.com" }, db)).toContain(IMAGE_MODEL_IDS[0]);
  expect(imageModelDisplayName("supplier-image-model")).toBe("supplier-image-model");
  expect(isImageModelId("supplier-image-model")).toBe(false);
  expect(isImageQualitySupported("supplier-image-model", "high")).toBe(false);
  expect(isImageQualitySupported("supplier-image-model", "auto")).toBe(true);
  db.close();
});

test("runtime preserves a catalog model on the wire and rejects unknown models without another request", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "shenbi-model-wire-"));
  try {
    const url = (name: string) => JSON.stringify(new URL(name, import.meta.url).href);
    const program = `
      import { appDb, configDb } from ${url("./db.ts")};
      import { initAppDb, initConfigDb } from ${url("./schema.ts")};
      import { writeProviderModelCatalogCache } from ${url("./providerModelCache.ts")};
      import { callProviderChain } from ${url("./providerRuntime.ts")};
      initAppDb(); initConfigDb();
      let received = [];
      const server = Bun.serve({hostname:'127.0.0.1',port:0,fetch:async(req)=>{
        received.push(await req.json());return Response.json({data:[{b64_json:'unit-test-only-image'}]});
      }});
      const provider = {...configDb.query('select * from provider_configs limit 1').get(),id:'wire-test',name:'Wire test',channel:'api',route_mode:'images_api',base_url:server.url.origin,generation_path:'/images/generations',model:'supplier-image-model',api_key_value:'',api_key_env:''};
      writeProviderModelCatalogCache(configDb,provider,{endpoint:server.url.origin+'/models',durationMs:1,models:['supplier-image-model'],imageModels:['supplier-image-model'],responsesModels:[]});
      const result = await callProviderChain([provider],'generation',{model:'supplier-image-model',prompt:'test only',n:1});
      if(received[0].model!=='supplier-image-model' || result.execution.actualModel!=='supplier-image-model') throw new Error('model silently replaced');
      let rejected=false;try {await callProviderChain([provider],'generation',{model:'unlisted-model',prompt:'test only'});}catch {rejected=true;}
      if(!rejected || received.length!==1)throw new Error('unlisted model submitted');
      server.stop(true);appDb.close();configDb.close();console.log('model-wire-ok');
    `;
    const processHandle = Bun.spawn([process.execPath, "--eval", program], {
      env: { ...Bun.env, GPT_IMAGE_DATA_DIR: directory, GPT_IMAGE_APP_DB_PATH: path.join(directory, "app.db"), GPT_IMAGE_CONFIG_DB_PATH: path.join(directory, "config.db") }, stdout: "pipe", stderr: "pipe"
    });
    const [stdout, stderr, code] = await Promise.all([new Response(processHandle.stdout).text(), new Response(processHandle.stderr).text(), processHandle.exited]);
    expect(stderr).toBe(""); expect(code).toBe(0); expect(stdout.trim()).toBe("model-wire-ok");
  } finally { await rm(directory, { recursive: true, force: true }); }
});
