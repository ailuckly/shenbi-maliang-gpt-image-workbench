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
      import { Hono } from 'hono';
      import { appDb, configDb } from ${url("./db.ts")};
      import { initAppDb, initConfigDb } from ${url("./schema.ts")};
      import { caseLibraryCategoryId, referenceCasesForRequest } from ${url("./caseLibrary.ts")};
      import { registerCaseLibraryRoutes } from ${url("./caseLibraryRoutes.ts")};
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
      const app = new Hono(); registerCaseLibraryRoutes(app);
      assert.equal((await app.request('/case-library/images/library-1.webp')).status, 401);
      assert.equal((await app.request('/config/case-library')).status, 401);
      assert.equal((await app.request('/config/case-library/sync', { method: 'POST' })).status, 401);
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
