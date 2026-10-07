import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

test("basic tier blocks Gemini and 4K, counts each saved image once, and enforces the daily limit", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "shenbi-tier-routing-"));
  try {
    const url = (name: string) => JSON.stringify(new URL(name, import.meta.url).href);
    const program = `
      import assert from 'node:assert/strict';
      import { appDb, configDb } from ${url("./db.ts")};
      import { initAppDb, initConfigDb } from ${url("./schema.ts")};
      import { checkGenerationAllowed, recordNewImageUsage, usageSummary } from ${url("./userTiers.ts")};
      initAppDb(); initConfigDb();
      const stamp = new Date().toISOString();
      appDb.query('insert into users(id,account,username,password_hash,created_at,updated_at) values(?,?,?,?,?,?)').run('U','u','u','x',stamp,stamp);
      appDb.query("update users set tier_id = 'basic' where id = 'U'").run();
      assert.equal(checkGenerationAllowed('U', { model: 'gemini-3.1-flash-image', quality: 'high', count: 1 }).code, 'model');
      assert.equal(checkGenerationAllowed('U', { model: 'gpt-image-2.5-sunburst', quality: 'max', count: 1 }).code, 'quality');
      assert.equal(checkGenerationAllowed('U', { model: 'gpt-image-2.5-sunburst', quality: 'high', count: 1 }).ok, true);
      recordNewImageUsage('U', ['img-1', 'img-2']);
      recordNewImageUsage('U', ['img-1', 'img-2', 'img-3']);
      assert.equal(usageSummary('U', 1).today.images, 3);
      appDb.query("update user_tiers set daily_image_limit = 3 where id = 'basic'").run();
      const blocked = checkGenerationAllowed('U', { model: 'gpt-image-2.5-sunburst', quality: 'high', count: 1 });
      assert.equal(blocked.code, 'daily_limit');
      assert.ok(blocked.message.includes('3/3'));
      appDb.close(); configDb.close(); console.log('tier-routing-ok');
    `;
    const child = Bun.spawn([process.execPath, "--eval", program], {
      env: { ...Bun.env, GPT_IMAGE_DATA_DIR: directory, GPT_IMAGE_APP_DB_PATH: path.join(directory, "app.db"), GPT_IMAGE_CONFIG_DB_PATH: path.join(directory, "config.db") },
      stdout: "pipe",
      stderr: "pipe"
    });
    const [stdout, stderr, code] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited]);
    expect(stderr).toBe("");
    expect(code).toBe(0);
    expect(stdout.trim().split("\n").at(-1)).toBe("tier-routing-ok");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}, 15000);
