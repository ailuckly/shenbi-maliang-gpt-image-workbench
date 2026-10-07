import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

test("library cases are picked by category and term overlap, and the image route validates names and auth", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "shenbi-case-library-"));
  try {
    const url = (name: string) => JSON.stringify(new URL(name, import.meta.url).href);
    const program = `
      import assert from 'node:assert/strict';
      import { readFile, mkdir, writeFile } from 'node:fs/promises';
      import sharp from 'sharp';
      import { CONFIG_COOKIE } from ${url("./constants.ts")};
      import { CASE_LIBRARY_SOURCES } from ${url("./caseLibrarySources.ts")};
      import { Hono } from 'hono';
      import { appDb, configDb } from ${url("./db.ts")};
      import { initAppDb, initConfigDb } from ${url("./schema.ts")};
      import { caseLibraryCategoryId, referenceCasesForRequest, caseLibraryStatus, startCaseLibrarySync, caseLibraryImageFile } from ${url("./caseLibrary.ts")};
      import { registerCaseLibraryRoutes, CASE_IMAGE_FILE } from ${url("./caseLibraryRoutes.ts")};
      initAppDb(); initConfigDb();
      const stamp = new Date().toISOString();
      const addCategory = (id) => appDb.query("insert into case_categories (id,type,name,slug,sort_order) values (?, 'case', ?, ?, 200)").run(caseLibraryCategoryId(id), id, 'library-' + id);
      addCategory('poster'); addCategory('ui');
      const addCase = (id, category, title, prompt) => appDb.query("insert into case_items (id,group_id,category_id,user_id,image_id,asset_id,include_references,review_status,title,prompt,image_url,created_at) values (?,?,?,null,null,null,0,'approved',?,?,?,?)").run(id, id, caseLibraryCategoryId(category), title, prompt, '/x.webp', stamp);
      addCase('library-1', 'poster', '咖啡开业海报', '精品咖啡店开业海报，暖色木质吧台，拿铁拉花，标题居中');
      addCase('library-2', 'poster', '音乐节海报', '夏日音乐节海报，霓虹灯光，人群剪影');
      addCase('library-3', 'ui', '咖啡点单界面', '咖啡点单 App 界面，卡片布局');
      addCase('user-case', 'poster', '用户案例', '咖啡开业海报');
      const picked = referenceCasesForRequest('做一张咖啡店开业海报', 'poster', 2);
      assert.equal(picked.length, 1);
      assert.equal(picked[0].title, '咖啡开业海报');
      assert.ok(!picked.some((item) => item.title === '咖啡点单界面' || item.title === '用户案例'));
      assert.deepEqual(referenceCasesForRequest('海报', 'brand'), []);

      initAppDb(); initAppDb();
      assert.equal(appDb.query("select count(*) as n from case_library_meta").get().n, 3);
      assert.equal(appDb.query("select source, model_family from case_library_meta where case_id='library-1'").get().model_family, 'gpt');
      addCase('library-ym-10', 'poster', '咖啡店开业海报', '精品咖啡店开业海报，暖色木质吧台，拿铁拉花，标题居中');
      appDb.query("insert into case_library_meta values (?, 'youmind', 'gemini', '[]', ?)").run('library-ym-10', stamp);
      for (let i=20; i<26; i++) addCase('library-'+i, 'poster', '音乐', '蓝色音乐演出');
      // Identical title/prompt produce exactly equal relevance scores.
      appDb.query("update case_items set title='咖啡店开业海报' where id='library-1'").run();
      assert.equal(referenceCasesForRequest('咖啡店开业海报', 'poster', 1)[0].title, '咖啡店开业海报');
      appDb.query("update case_items set title='咖啡店开业海报 新来源' where id='library-ym-10'").run();
      const legacyFirst = appDb.query("select id, title, prompt from case_items where id like ? and category_id = ?").all('library-%', caseLibraryCategoryId('poster')).find((row) => row.title.startsWith('咖啡店开业海报'));
      assert.equal(referenceCasesForRequest('咖啡店开业海报', 'poster', 1)[0].title, legacyFirst.title);
      assert.equal(referenceCasesForRequest('咖啡店开业海报', 'poster', 1, 'gemini')[0].title, '咖啡店开业海报 新来源');
      assert.equal(referenceCasesForRequest('咖啡店开业海报', 'poster', 1, 'gpt')[0].title, '咖啡店开业海报');
      appDb.query("update case_items set title='音乐', prompt='蓝色演出' where id='library-ym-10'").run();
      assert.equal(referenceCasesForRequest('咖啡店开业海报', 'poster', 1, 'gemini')[0].title, '咖啡店开业海报');
      appDb.query("delete from case_items where id='library-ym-10'").run();
      assert.equal(appDb.query("select * from case_library_meta where case_id='library-ym-10'").get(), null);
      for (const file of ['library-1.webp','library-nbcn-627.webp','library-ym-6847.webp','library-ym-featured-1.webp']) assert.ok(CASE_IMAGE_FILE.test(file));
      for (const file of ['../library-1.webp','library-ym-../1.webp','library-foo-1.webp','library-1.png']) assert.ok(!CASE_IMAGE_FILE.test(file));
      const app = new Hono(); registerCaseLibraryRoutes(app);
      assert.equal((await app.request('/case-library/images/library-1.webp')).status, 401);
      assert.equal((await app.request('/config/case-library')).status, 401);
      assert.equal((await app.request('/config/case-library/sync', { method: 'POST' })).status, 401);

      configDb.query("insert into config_auth_sessions (id, expires_at, created_at) values ('library-test', '2999-01-01T00:00:00.000Z', '2026-10-07')").run();
      const headers = { cookie: CONFIG_COOKIE+'=library-test' };
      assert.equal((await app.request('/config/case-library/sync', { method:'POST', headers, body:'{"source":"no-such-source"}' })).status, 400);
      assert.equal((await app.request('/config/case-library/sync', { method:'POST', headers, body:'{' })).status, 400);
      const before = await (await app.request('/config/case-library', { headers })).json();
      assert.equal(before.sources.length, 3);
      assert.equal(before.sources[0].count, 3);
      const seen = [];
      const image = await sharp({ create: { width: 4, height: 4, channels: 3, background: '#ffffff' } }).png().toBuffer();
      globalThis.fetch = async (input) => {
        const url = String(input); seen.push(url);
        if (url.endsWith('/data/cases.json')) return Response.json({ cases: [{id:1,title:'旧案例',prompt:'商品图',image:'images/1.png',category:'Products & E-commerce'}] });
        if (url.endsWith('/data/prompts.json')) return Response.json({items:[{id:627,title:'新案例',prompts:['商品图'],images:['images/627.jpeg'],tags:['product']}]});
        if (url.endsWith('/README_zh.md')) return new Response(await readFile(${url("./fixtures/caseLibrary/youmind-README_zh.sample.md")}.replace('file://',''), 'utf8'));
        if (url.startsWith('https://cms-assets.youmind.com/')) return new Response('invalid image');
        if (url.endsWith('/images/627.jpeg')) return new Response(image);
        throw new Error('Unexpected network request: '+url);
      };
      await mkdir(${JSON.stringify(path.join(directory, 'files', 'case-library'))}, {recursive:true});
      await writeFile(caseLibraryImageFile('library-1'), 'existing-file');
      assert.equal(startCaseLibrarySync(), true);
      assert.equal(startCaseLibrarySync('youmind'), false);
      while (caseLibraryStatus().running) await Bun.sleep(5);
      const synced = caseLibraryStatus();
      assert.equal(synced.total, 4); assert.equal(synced.processed, 4); assert.equal(synced.failed, 2);
      assert.equal(synced.sources[1].count, 1); assert.equal(synced.sources[2].status.failed, 2);
      assert.equal(await readFile(caseLibraryImageFile('library-1'), 'utf8'), 'existing-file');
      assert.ok(!seen.some((url) => url.endsWith('/images/1.png')));
      assert.equal(appDb.query("select model_family from case_library_meta where case_id='library-nbcn-627'").get().model_family, 'gemini');
      const started = await app.request('/config/case-library/sync', {method:'POST',headers,body:'{"source":"nanobanana-cn"}'});
      assert.equal(started.status, 202);
      while (caseLibraryStatus().running) await Bun.sleep(5);
      assert.equal(seen.filter((url) => url.endsWith('/images/627.jpeg')).length, 1);
      globalThis.fetch = async () => { throw new Error('fixture source unavailable'); };
      assert.equal(startCaseLibrarySync(), true);
      while (caseLibraryStatus().running) await Bun.sleep(5);
      assert.ok(caseLibraryStatus().sources.every((source) => source.status.error.includes('fixture source unavailable')));
      appDb.close(); configDb.close(); console.log('case-library-ok');
    `;
    const child = Bun.spawn([process.execPath, "--eval", program], {
      env: { ...Bun.env, GPT_IMAGE_DATA_DIR: directory, GPT_IMAGE_APP_DB_PATH: path.join(directory, "app.db"), GPT_IMAGE_CONFIG_DB_PATH: path.join(directory, "config.db") },
      stdout: "pipe",
      stderr: "pipe"
    });
    const [stdout, stderr, code] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited]);
    expect(stderr).toBe("");
    expect(code).toBe(0);
    expect(stdout.trim().split("\n").at(-1)).toBe("case-library-ok");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}, 15000);
