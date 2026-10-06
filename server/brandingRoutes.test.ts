import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { DEFAULT_SOURCE_CODE_URL, normalizeSourceCodeUrl } from "../src/lib/sourceCode";

test("source link accepts HTTP(S), rejects script schemes and credential URLs", () => {
  expect(normalizeSourceCodeUrl("")).toBe(DEFAULT_SOURCE_CODE_URL);
  expect(normalizeSourceCodeUrl(" https://example.com/source ")).toBe("https://example.com/source");
  for (const value of ["javascript:alert(1)", "data:text/html,test", "https://user@example.com/source", "not a url"]) {
    expect(() => normalizeSourceCodeUrl(value)).toThrow();
  }
});

test("branding source URL persists, public flag follows switch, invalid and unauthenticated writes fail", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "shenbi-branding-"));
  try {
    const url = (name: string) => JSON.stringify(new URL(name, import.meta.url).href);
    const program = `
      import { Hono } from 'hono';
      import { configDb } from ${url("./db.ts")};
      import { initConfigDb } from ${url("./schema.ts")};
      import { registerBrandingRoutes, invalidatePublicBrandingCache } from ${url("./branding.ts")};
      import { saveGlobalSwitch } from ${url("./globalSwitches.ts")};
      initConfigDb(); initConfigDb();
      const app = new Hono(); registerBrandingRoutes(app);
      const initial = await (await app.request('/branding')).json();
      if(initial.sourceCodeUrl !== ${JSON.stringify(DEFAULT_SOURCE_CODE_URL)} || !initial.showGithubEntry) throw new Error('default missing');
      if((await app.request('/config/branding',{method:'PUT',body:'{}'})).status!==401) throw new Error('unauthorized write');
      const session = crypto.randomUUID();
      configDb.query('insert into config_auth_sessions(id,expires_at,created_at) values (?,?,?)').run(session,new Date(Date.now()+60000).toISOString(),new Date().toISOString());
      const headers = {'content-type':'application/json',cookie:'config_session='+session};
      const invalid = await app.request('/config/branding',{method:'PUT',headers,body:JSON.stringify({sourceCodeUrl:'javascript:alert(1)'})});
      if(invalid.status !== 400) throw new Error('unsafe link accepted');
      const saved = await app.request('/config/branding',{method:'PUT',headers,body:JSON.stringify({siteName:'ShenBi',sourceCodeUrl:'https://example.com/source'})});
      if(saved.status !== 200) throw new Error('save failed');
      initConfigDb(); invalidatePublicBrandingCache();
      const persisted = await (await app.request('/branding')).json();
      if(persisted.sourceCodeUrl !== 'https://example.com/source') throw new Error('not persisted');
      saveGlobalSwitch('github_entry',false);invalidatePublicBrandingCache();
      if((await (await app.request('/branding')).json()).showGithubEntry) throw new Error('switch ignored');
      console.log('branding-source-ok');configDb.close();
    `;
    const processHandle = Bun.spawn([process.execPath, "--eval", program], {
      env: { ...Bun.env, GPT_IMAGE_DATA_DIR: directory, GPT_IMAGE_APP_DB_PATH: path.join(directory, "app.db"), GPT_IMAGE_CONFIG_DB_PATH: path.join(directory, "config.db") }, stdout: "pipe", stderr: "pipe"
    });
    const [stdout, stderr, code] = await Promise.all([new Response(processHandle.stdout).text(), new Response(processHandle.stderr).text(), processHandle.exited]);
    expect(stderr).toBe(""); expect(code).toBe(0); expect(stdout.trim()).toBe("branding-source-ok");
  } finally { await rm(directory, { recursive: true, force: true }); }
});
