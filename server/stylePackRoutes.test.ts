import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

test("style APIs enforce owner/config authorization, validation, visibility, preview and audit", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "shenbi-style-routes-"));
  try {
    const url = (name: string) => JSON.stringify(new URL(name, import.meta.url).href);
    const program = `
      import assert from 'node:assert/strict';
      import { Hono } from 'hono';
      import { appDb,configDb } from ${url("./db.ts")};
      import { initAppDb,initConfigDb } from ${url("./schema.ts")};
      import { registerStylePackRoutes } from ${url("./stylePackRoutes.ts")};
      import { composePrompt } from ${url("./promptEngine/compose.ts")};
      initAppDb();initConfigDb();
      const expiry = new Date(Date.now()+60000).toISOString();
      const stamp = new Date().toISOString();
      const sessions = {};
      for(const user of ['A','B']) {
        appDb.query('insert into users(id,account,username,password_hash,has_config_access,created_at,updated_at) values(?,?,?,?,?,?,?)').run(user,'test-'+user,'test-'+user,'test-only',1,stamp,stamp);
        sessions[user] = crypto.randomUUID();
        appDb.query('insert into user_auth_sessions values(?,?,?,?)').run(sessions[user],user,expiry,stamp);
      }
      const admin = crypto.randomUUID();
      configDb.query('insert into config_auth_sessions values(?,?,?)').run(admin,expiry,stamp);
      const app = new Hono();registerStylePackRoutes(app);
      const request = (route,method='GET',body,user='') => app.request(route,{method,headers:{'content-type':'application/json',...(user?{cookie:user==='admin'?'config_session='+admin:'app_session='+sessions[user]}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
      for(const [route,method] of [['/style-packs','GET'],['/style-packs','POST'],['/style-packs/unknown','PATCH'],['/style-packs/unknown','DELETE'],['/style-packs/preview','POST']]) assert.equal((await request(route,method,{})).status,401);
      assert.equal((await request('/config/style-packs','GET',undefined,'A')).status,401);
      const draft = {groupKey:'brand',name:'Private A',optimizeInstruction:'Keep brand',promptPrefix:'studio light',promptSuffix:'studio light',negativePrompt:'blur, watermark',recommendedParams:{n:2,quality:'high'}};
      const created = await request('/style-packs','POST',draft,'A');assert.equal(created.status,201);
      const pack = (await created.json()).stylePack;
      assert.equal(pack.scope,'user');assert.equal(pack.ownerUserId,undefined);
      assert.equal((await request('/style-packs/'+pack.id,'PATCH',{name:'stolen'},'B')).status,404);
      assert.equal((await request('/style-packs/'+pack.id,'DELETE',undefined,'B')).status,404);
      assert.equal((await request('/style-packs/preview','POST',{prompt:'bottle',stylePackId:pack.id},'B')).status,404);
      assert(!(await (await request('/style-packs','GET',undefined,'B')).json()).stylePacks.some(p=>p.id===pack.id));
      for(const invalid of [{...draft,name:'x'.repeat(41)},{...draft,description:'x'.repeat(201)},{...draft,promptPrefix:'x'.repeat(2001)},{...draft,recommendedParams:{n:0}},{...draft,scope:'system'},{...draft,ownerUserId:'B'}]) assert.equal((await request('/style-packs','POST',invalid,'A')).status,400);
      const malformed = await app.request('/style-packs',{method:'POST',headers:{cookie:'app_session='+sessions.A},body:'{broken'});assert.equal(malformed.status,400);
      const previewInput = {prompt:'bottle',negativePrompt:'BLUR, extra bottle',stylePackId:pack.id,userParams:{n:3}};
      const preview = await request('/style-packs/preview','POST',previewInput,'A');assert.equal(preview.status,200);
      assert.deepEqual(await preview.json(),composePrompt({...previewInput,stylePack:pack}));
      const edited = await (await request('/style-packs/preview','POST',{...previewInput,prompt:'My exact text',manuallyEdited:true},'A')).json();assert.equal(edited.finalPrompt,'My exact text');
      assert.equal((await request('/style-packs/'+pack.id,'PATCH',{enabled:false},'A')).status,200);
      assert((await (await request('/style-packs','GET',undefined,'A')).json()).stylePacks.some(p=>p.id===pack.id));
      assert.equal((await request('/style-packs/preview','POST',previewInput,'A')).status,400);
      assert.equal((await request('/config/style-packs/'+pack.id,'PATCH',{name:'admin takeover'},'admin')).status,404);
      const system = (await (await request('/config/style-packs','POST',{...draft,name:'System'},'admin')).json()).stylePack;
      assert.equal((await request('/style-packs/'+system.id,'PATCH',{name:'takeover'},'A')).status,404);
      assert.equal((await request('/config/style-packs/'+system.id,'PATCH',{enabled:false,sortOrder:25},'admin')).status,200);
      assert(!(await (await request('/style-packs','GET',undefined,'A')).json()).stylePacks.some(p=>p.id===system.id));
      assert((await (await request('/config/style-packs','GET',undefined,'admin')).json()).stylePacks.some(p=>p.id===system.id));
      assert.equal((await request('/config/style-packs/'+system.id,'DELETE',undefined,'admin')).status,200);
      assert.equal(configDb.query("select count(*) as count from config_audit_logs where action like 'style_pack.%'").get().count,3);
      assert.equal((await request('/style-packs/'+pack.id,'DELETE',undefined,'A')).status,200);
      console.log('style-routes-ok');appDb.close();configDb.close();
    `;
    const child = Bun.spawn([process.execPath,"--eval",program],{env:{...Bun.env,GPT_IMAGE_DATA_DIR:directory,GPT_IMAGE_APP_DB_PATH:path.join(directory,"app.db"),GPT_IMAGE_CONFIG_DB_PATH:path.join(directory,"config.db")},stdout:"pipe",stderr:"pipe"});
    const [stdout,stderr,code] = await Promise.all([new Response(child.stdout).text(),new Response(child.stderr).text(),child.exited]);
    expect(stderr).toBe("");expect(code).toBe(0);expect(stdout.trim()).toBe("style-routes-ok");
  } finally { await rm(directory,{recursive:true,force:true}); }
});
