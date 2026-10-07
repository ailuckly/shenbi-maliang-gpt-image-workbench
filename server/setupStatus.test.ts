import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

test("setup status flags broken assignments and hot temperatures, and fixes them", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "shenbi-setup-status-"));
  try {
    const url = (name: string) => JSON.stringify(new URL(name, import.meta.url).href);
    const program = `
      import assert from 'node:assert/strict';
      import { appDb, configDb } from ${url("./db.ts")};
      import { initAppDb, initConfigDb } from ${url("./schema.ts")};
      import { applySetupFix, setupStatus } from ${url("./setupStatus.ts")};
      initAppDb(); initConfigDb();
      const stamp = new Date().toISOString();
      configDb.run('delete from prompt_optimizer_providers');
      const addText = (id, enabled, temperature) => configDb.query("insert into prompt_optimizer_providers (id,name,enabled,base_url,endpoint_path,api_key_env,api_key_value,model,models_json,availability_status,availability_error,availability_checked_at,stream_enabled,thinking_enabled,temperature,max_tokens,retry_count,sort_order,created_at,updated_at) values (?,?,?,'https://x','/chat/completions','','k','text-model','[]','normal','','',0,0,?,0,1,100,?,?)").run(id, id, enabled, temperature, stamp, stamp);
      addText('on', 1, 2.0); addText('off', 0, null);
      const assign = (key, provider, model) => configDb.query('insert into language_model_assignments values (?,?,?,?)').run(key, provider, model, stamp);
      assign('global.default', 'off', 'text-model');
      assign('prompt.optimize', 'on', 'gpt-image-2.5-sunburst');
      assign('title.chat', 'on', 'text-model');
      const ids = setupStatus().issues.map((issue) => issue.id);
      assert.ok(ids.includes('invalid-assignments'));
      assert.ok(ids.includes('high-temperature'));
      assert.equal(applySetupFix('remove_invalid_assignments').changed, 2);
      assert.deepEqual(configDb.query('select usage_key from language_model_assignments').all().map((row) => row.usage_key), ['title.chat']);
      assert.equal(applySetupFix('reset_temperature').changed, 1);
      assert.equal(configDb.query("select temperature from prompt_optimizer_providers where id='on'").get().temperature, 0.7);
      const after = setupStatus().issues.map((issue) => issue.id);
      assert.ok(!after.includes('invalid-assignments') && !after.includes('high-temperature'));
      assert.equal(applySetupFix('unknown'), null);
      appDb.close(); configDb.close(); console.log('setup-ok');
    `;
    const child = Bun.spawn([process.execPath, "--eval", program], {
      env: { ...Bun.env, GPT_IMAGE_DATA_DIR: directory, GPT_IMAGE_APP_DB_PATH: path.join(directory, "app.db"), GPT_IMAGE_CONFIG_DB_PATH: path.join(directory, "config.db") },
      stdout: "pipe",
      stderr: "pipe"
    });
    const [stdout, stderr, code] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited]);
    expect(stderr).toBe("");
    expect(code).toBe(0);
    expect(stdout.trim().split("\n").at(-1)).toBe("setup-ok");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}, 15000);
