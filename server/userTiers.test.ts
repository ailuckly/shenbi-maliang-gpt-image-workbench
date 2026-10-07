import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

async function isolated(program: string) {
  const directory = await mkdtemp(path.join(tmpdir(), "shenbi-user-tiers-"));
  const url = (name: string) => JSON.stringify(new URL(name, import.meta.url).href);
  try {
    const child = Bun.spawn([process.execPath, "--eval", `
      import assert from 'node:assert/strict';
      import { Database } from 'bun:sqlite';
      import { Hono } from 'hono';
      import { readFileSync } from 'node:fs';
      import { requireConfig } from ${url("./auth.ts")};
      import { audit } from ${url("./auditLog.ts")};
      import { defaultTeamId } from ${url("./categories.ts")};
      import { validateUsername } from ${url("./usernamePolicy.ts")};
      import { normalizePhone as normalizeSmsPhone } from ${url("./sms.ts")};
      import { makeId, now } from ${url("./utils.ts")};
      const indexUrl = ${url("./index.ts")};
      import { appDb, configDb, getAll, getOne, run } from ${url("./db.ts")};
      import { initAppDb, initConfigDb } from ${url("./schema.ts")};
      import { migrateUserTiers, listTiers, getTier, tierForUser, checkGenerationAllowed, checkOptimizeAllowed, recordImageUsage, recordOptimizeUsage, recordCheckUsage, usageSummary } from ${url("./userTiers.ts")};
      import { registerUserTierRoutes } from ${url("./userTierRoutes.ts")};
      import { APP_COOKIE, CONFIG_COOKIE } from ${url("./constants.ts")};
      import { localTimestamp } from ${url("./utils.ts")};
      initAppDb(); initConfigDb();
      const stamp = localTimestamp();
      const day = stamp.slice(0, 10);
      const addUser = (id, tier = null) => appDb.query("insert into users(id, account, username, password_hash, tier_id, created_at, updated_at) values (?, ?, ?, 'unused', ?, ?, ?)").run(id, id, id, tier, stamp, stamp);
      addUser('A'); addUser('B', 'pro');
      const api = new Hono(); registerUserTierRoutes(api);
      configDb.query("insert into config_auth_sessions(id, expires_at, created_at) values ('admin', '2999-01-01T00:00:00.000Z', '2026-01-01')").run();
      appDb.query("insert into user_auth_sessions(id, user_id, expires_at, created_at) values ('user-a', 'A', '2999-01-01T00:00:00.000Z', '2026-01-01')").run();
      const call = (method, route, body, auth = 'admin') => api.request(route, { method, headers: { 'Content-Type': 'application/json', Cookie: auth === 'admin' ? CONFIG_COOKIE + '=admin' : auth === 'user' ? APP_COOKIE + '=user-a' : '' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
      ${program}
      appDb.close(); configDb.close(); console.log('tiers-ok');
    `], {
      env: { ...Bun.env, TZ: "Asia/Shanghai", GPT_IMAGE_DATA_DIR: directory, GPT_IMAGE_APP_DB_PATH: path.join(directory, "app.db"), GPT_IMAGE_CONFIG_DB_PATH: path.join(directory, "config.db") }, stdout: "pipe", stderr: "pipe"
    });
    const [stdout, stderr, code] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited]);
    expect(stderr).toBe(""); expect(code).toBe(0); expect(stdout.trim().split("\n").at(-1)).toBe("tiers-ok");
  } finally { await rm(directory, { recursive: true, force: true }); }
}

test("user tier migration assigns existing admins/pro, users/basic and does not reseed deleted or edited tiers", () => isolated(`
  const legacy = new Database(':memory:');
  legacy.exec("pragma foreign_keys=on; create table app_migrations(id text primary key, created_at text); create table users(id text primary key, has_config_access integer); insert into users values ('admin',1),('regular',0)");
  migrateUserTiers(legacy);
  assert.deepEqual(legacy.query('select tier_id from users order by id').all(), [{tier_id:'pro'},{tier_id:'basic'}]);
  assert.equal(legacy.query('select count(*) as n from user_tiers').get().n, 3);
  legacy.exec("update users set tier_id=null where id='admin'; delete from user_tiers where id='pro'; update user_tiers set name='Edited' where id='basic'");
  migrateUserTiers(legacy);
  assert.equal(legacy.query("select name from user_tiers where id='basic'").get().name, 'Edited');
  assert.equal(legacy.query("select * from user_tiers where id='pro'").get(), null);
  assert.equal(legacy.query("select tier_id from users where id='admin'").get().tier_id, null);
  legacy.close();
  assert.equal(tierForUser('A').id, 'basic'); assert.equal(tierForUser('B').id,'pro');
  assert.throws(() => tierForUser('missing'));
`), 15000);

test("generation checks model families, quality order/auto, remaining batch quota and unlimited tiers", () => isolated(`
  const check = (model, quality='high', count=1, user='A') => checkGenerationAllowed(user,{model,quality,count});
  for (const model of ['gpt-image-1','gpt-image-2.5-sunburst','vendor/codex-gpt-image-2']) assert.equal(check(model).ok,true);
  for (const model of ['gemini-image','dall-e-3','text-gpt-image-1','gpt-image-']) assert.equal(check(model).code,'model');
  for (const quality of ['low','medium','high','auto']) assert.equal(check('gpt-image-1',quality).ok,true);
  for (const quality of ['xhigh','max','invalid']) assert.equal(check('gpt-image-1',quality).code,'quality');
  recordImageUsage('A',19); assert.equal(check('gpt-image-1','high',1).ok,true);
  const denied=check('gpt-image-1','high',2); assert.equal(denied.code,'daily_limit'); assert.ok(denied.message.includes('19/20'));
  recordImageUsage('A',1); assert.equal(check('gpt-image-1').ok,false);
  appDb.query("update users set tier_id='advanced' where id='A'").run();
  assert.equal(check('gemini-image','high',80).ok,true); assert.equal(check('gemini-image','max').code,'quality');
  assert.equal(check('gemini-image','high',81).code,'daily_limit');
  recordImageUsage('B',100000); assert.equal(check('gemini-image','max',100,'B').ok,true);
  appDb.query("update user_tiers set allowed_models_json='[\\"exact-model\\"]',max_quality='xhigh' where id='basic'").run();
  appDb.query("update users set tier_id='basic' where id='A'").run();
  assert.equal(check('exact-model','xhigh',0).ok,true); assert.equal(check('vendor/exact-model','low',0).code,'model');
`), 15000);

test("usage counters add independently, reject bad counts, isolate users, cascade and use local calendar history", () => isolated(`
  assert.deepEqual(usageSummary('A').today,{images:0,optimizes:0,checks:0});
  recordImageUsage('A',2); recordImageUsage('A',3); recordOptimizeUsage('A',4); recordCheckUsage('A',6);
  assert.deepEqual(usageSummary('A').today,{images:5,optimizes:4,checks:6});
  assert.deepEqual(usageSummary('B').today,{images:0,optimizes:0,checks:0});
  for (const count of [-1,0.5,NaN,Infinity,Number.MAX_SAFE_INTEGER+1]) {
    assert.throws(() => recordImageUsage('A',count)); assert.throws(() => checkOptimizeAllowed('A',count));
    assert.throws(() => checkGenerationAllowed('A',{model:'gpt-image-1',quality:'high',count}));
  }
  assert.throws(() => recordImageUsage('missing',1));
  const yesterday=new Date(); yesterday.setDate(yesterday.getDate()-1);
  const previous=localTimestamp(yesterday).slice(0,10);
  appDb.query('insert into user_usage_daily values (?, ?, 9, 10, 11)').run('A',previous);
  const history=usageSummary('A',7).history;
  assert.equal(history.length,7); assert.equal(history.at(-1).day,day); assert.equal(history.at(-2).images,9);
  assert.equal(history[0].images,0); assert.equal(usageSummary('A',1).history.length,1);
  for (const days of [0,367,NaN,1.5]) assert.throws(() => usageSummary('A',days));
  const realDate=globalThis.Date;
  globalThis.Date=class extends realDate { constructor(...args) { super(...(args.length ? args : ['2026-10-07T16:30:00Z'])); } };
  recordCheckUsage('B',2); assert.equal(usageSummary('B',2).history.at(-1).day,'2026-10-08');
  globalThis.Date=realDate;
  appDb.query("delete from user_auth_sessions where user_id='A'").run();
  appDb.query("delete from users where id='A'").run();
  assert.equal(appDb.query("select count(*) as n from user_usage_daily where user_id='A'").get().n,0);
`), 15000);

test("optimization quota counts calls and leaves quality checks independent", () => isolated(`
  recordOptimizeUsage('A',28); assert.equal(checkOptimizeAllowed('A',2).ok,true);
  assert.equal(checkOptimizeAllowed('A',3).code,'daily_limit'); recordOptimizeUsage('A',2);
  recordCheckUsage('A',200); assert.equal(checkOptimizeAllowed('A',1).ok,false);
  recordOptimizeUsage('B',100000); assert.equal(checkOptimizeAllowed('B',100).ok,true);
  appDb.query("update users set tier_id='advanced' where id='A'").run();
  assert.equal(checkOptimizeAllowed('A',170).ok,true); assert.equal(checkOptimizeAllowed('A',171).ok,false);
`), 15000);

test("tier and usage routes enforce separate authentication and user privacy without network", () => isolated(`
  for (const [method,route,body] of [['GET','/config/user-tiers'],['POST','/config/user-tiers',{name:'X'}],['PATCH','/config/user-tiers/basic',{name:'X'}],['DELETE','/config/user-tiers/pro'],['GET','/config/users/usage']]) {
    assert.equal((await call(method,route,body,'none')).status,401);
    assert.equal((await call(method,route,body,'user')).status,401);
  }
  assert.equal((await call('GET','/me/usage',undefined,'none')).status,401);
  assert.equal((await call('GET','/me/usage',undefined,'admin')).status,401);
  recordImageUsage('A',3); recordImageUsage('B',8);
  const mine=await (await call('GET','/me/usage?userId=B',undefined,'user')).json();
  assert.equal(mine.today.images,3); assert.equal(mine.tier.id,'basic');
  const all=await (await call('GET','/config/users/usage?days=7')).json();
  assert.equal(all.users.length,2); assert.equal(all.users[1].history.length,7);
  for (const days of ['0','367','1.5','bad']) assert.equal((await call('GET','/config/users/usage?days='+days)).status,400);
  appDb.query("update users set disabled=1 where id='A'").run();
  assert.equal((await call('GET','/me/usage',undefined,'user')).status,401);
`), 15000);

test("tier CRUD validates fields, protects default, reassigns deleted tiers and audits mutations", () => isolated(`
  const response=await call('POST','/config/user-tiers',{name:'Custom',allowedModels:['exact'],dailyImageLimit:4});
  assert.equal(response.status,201); const custom=(await response.json()).tier;
  assert.equal(custom.isDefault,false);
  appDb.query('update users set tier_id=? where id=?').run(custom.id,'B');
  assert.equal((await call('PATCH','/config/user-tiers/'+custom.id,{description:'Changed'})).status,200);
  assert.equal(getTier(custom.id).dailyImageLimit,4); assert.deepEqual(getTier(custom.id).allowedModels,['exact']);
  assert.equal((await call('DELETE','/config/user-tiers/basic')).status,400);
  assert.equal((await call('PATCH','/config/user-tiers/basic',{isDefault:false})).status,400);
  assert.equal((await call('DELETE','/config/user-tiers/'+custom.id)).status,200);
  assert.equal(tierForUser('B').id,'basic');
  assert.equal((await call('PATCH','/config/user-tiers/advanced',{isDefault:true})).status,200);
  assert.equal(tierForUser('A').id,'advanced'); assert.equal(getTier('basic').isDefault,false);
  assert.equal((await call('DELETE','/config/user-tiers/advanced')).status,400);
  assert.equal((await call('DELETE','/config/user-tiers/basic')).status,200);
  assert.equal(tierForUser('B').id,'advanced');
  initAppDb(); assert.equal(getTier('basic'),null); assert.equal(listTiers().filter(tier=>tier.isDefault).length,1);
  for (const input of [{name:''},{name:'X',dailyImageLimit:-1},{name:'X',dailyOptimizeLimit:0.5},{name:'X',maxQuality:'auto'},{name:'X',allowedModels:[4]},{name:'X',isDefault:1},{name:'X',unknown:true},null,[]]) assert.equal((await call('POST','/config/user-tiers',input)).status,400);
  assert.equal((await call('PATCH','/config/user-tiers/pro',{})).status,400);
  assert.equal((await call('PATCH','/config/user-tiers/absent',{name:'X'})).status,404);
  assert.equal((await call('DELETE','/config/user-tiers/absent')).status,404);
  const actions=configDb.query("select action from config_audit_logs where action like 'user_tier.%'").all().map(row=>row.action);
  assert.deepEqual(actions,['user_tier.create','user_tier.update','user_tier.delete','user_tier.update','user_tier.delete']);
`), 15000);

// Evaluate the existing index handlers in-process to avoid starting its server/schedulers.
test("config user handlers create/edit/fallback tiers, filter by team/tier and audit without a listening port", () => isolated(`
  const source=readFileSync(new URL(indexUrl),'utf8');
  const helpers=source.slice(source.indexOf('function normalizeEmail('),source.indexOf('const CPA_SYNC_MIN_FREQUENCY_MINUTES'));
  const handlers=source.slice(source.indexOf('api.get("/config/users",'),source.indexOf('api.post("/config/users/:id/reset-password",'));
  const bindings={api,requireConfig,audit,defaultTeamId,validateUsername,normalizeSmsPhone,makeId,now,appDb,getAll,getOne,run,getTier,tierForUser,usageSummary};
  new Function(...Object.keys(bindings),new Bun.Transpiler({loader:'ts'}).transformSync(helpers+handlers))(...Object.values(bindings));
  appDb.query("insert into teams values ('T','Test team','',?,?)").run(stamp,stamp);
  const fields={account:'new-account',username:'New User',password:'test-only',teamId:'T',tierId:'advanced',hasConfigAccess:false,disabled:false};
  assert.equal((await call('POST','/config/users',fields,'none')).status,401);
  assert.equal((await call('POST','/config/users',{...fields,tierId:'missing'})).status,400);
  const created=await call('POST','/config/users',fields); assert.equal(created.status,200);
  const id=(await created.json()).user.id; assert.equal(tierForUser(id).id,'advanced');
  assert.equal((await call('PATCH','/config/users/'+id,{tierId:'pro'})).status,200);
  assert.equal(tierForUser(id).id,'pro');
  assert.equal((await call('PATCH','/config/users/'+id,{disabled:true})).status,200);
  assert.equal(tierForUser(id).id,'pro');
  assert.equal((await call('PATCH','/config/users/'+id,{tierId:'missing'})).status,400);
  assert.equal((await call('PATCH','/config/users/'+id,{tierId:4})).status,400);
  recordImageUsage(id,7);
  const selected=await (await call('GET','/config/users?teamId=T&tierId=pro')).json();
  assert.equal(selected.users.length,1); assert.equal(selected.users[0].tier.name,'专业'); assert.equal(selected.users[0].today.images,7);
  assert.equal((await (await call('GET','/config/users?teamId=T&tierId=basic')).json()).users.length,0);
  assert.equal((await call('PATCH','/config/users/'+id,{tierId:''})).status,200);
  assert.equal(tierForUser(id).id,'basic');
  assert.equal((await (await call('GET','/config/users?teamId=T&tierId=basic')).json()).users.length,1);
  const fallback=await call('POST','/config/users',{...fields,account:'default-account',username:'Default User',tierId:''});
  assert.equal(fallback.status,200); assert.equal(tierForUser((await fallback.json()).user.id).id,'basic');
  const logs=configDb.query("select detail from config_audit_logs where action='user.update'").all();
  assert.ok(logs.some(row=>JSON.parse(row.detail).tierId==='pro'));
  assert.ok(logs.some(row=>JSON.parse(row.detail).tierId===''));
`), 15000);
