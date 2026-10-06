import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { configTabVisible } from "../src/config/configNav";

test("hidden admin tabs require their existing switches; API channel configuration stays visible", () => {
  for (const [tab, type] of [["imageAccounts", "chatgpt_web_entry"], ["cpa", "cpa_sync"], ["sms", "sms_service"], ["soundManagement", "sound_management_entry"]] as const) {
    expect(configTabVisible(tab, {})).toBe(false);
    expect(configTabVisible(tab, { [type]: true })).toBe(true);
  }
  expect(configTabVisible("providers", {})).toBe(true);
  expect(configTabVisible("imageMode", {})).toBe(true);
});

test("entry migration defaults off, preserves existing values and exposes only public entries", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "shenbi-switches-"));
  try {
    const url = (name: string) => JSON.stringify(new URL(name, import.meta.url).href);
    const program = `
      import { configDb } from ${url("./db.ts")};
      import { initConfigDb } from ${url("./schema.ts")};
      import { globalSwitches, globalSwitchEnabled, saveGlobalSwitch } from ${url("./globalSwitches.ts")};
      import { publicBranding, invalidatePublicBrandingCache } from ${url("./branding.ts")};
      initConfigDb();
      const hidden = ['entertainment_entry','inspiration_entry','inspiration_barrage_entry','image_provenance_entry','chatgpt_web_entry','sound_management_entry','ai_client_install_entry','cpa_sync','sms_service'];
      for(const type of hidden) if(globalSwitchEnabled(type)) throw new Error('default on: '+type);
      saveGlobalSwitch('ai_client_install_entry',true); saveGlobalSwitch('asset_review',false);
      configDb.query('delete from global_switch_settings where type = ?').run('image_provenance_entry');
      initConfigDb();
      if(!globalSwitchEnabled('ai_client_install_entry') || globalSwitchEnabled('asset_review')) throw new Error('existing value changed');
      if(globalSwitchEnabled('image_provenance_entry')) throw new Error('new default changed');
      const count = globalSwitches().length; initConfigDb();
      if(globalSwitches().length !== count) throw new Error('duplicate switches');
      saveGlobalSwitch('image_provenance_entry', true); invalidatePublicBrandingCache();
      const branding = await publicBranding();
      if(!branding.featureFlags.image_provenance_entry || !branding.showAiClientInstallEntry) throw new Error('entry missing');
      if(Object.keys(branding.featureFlags).some(type=>!type.endsWith('_entry'))) throw new Error('operational flag exposed');
      console.log('switch-migration-ok'); configDb.close();
    `;
    const processHandle = Bun.spawn([process.execPath, "--eval", program], {
      env: { ...Bun.env, GPT_IMAGE_DATA_DIR: directory, GPT_IMAGE_APP_DB_PATH: path.join(directory, "app.db"), GPT_IMAGE_CONFIG_DB_PATH: path.join(directory, "config.db") }, stdout: "pipe", stderr: "pipe"
    });
    const [stdout, stderr, code] = await Promise.all([new Response(processHandle.stdout).text(), new Response(processHandle.stderr).text(), processHandle.exited]);
    expect(stderr).toBe(""); expect(code).toBe(0); expect(stdout.trim()).toBe("switch-migration-ok");
  } finally { await rm(directory, { recursive: true, force: true }); }
});
