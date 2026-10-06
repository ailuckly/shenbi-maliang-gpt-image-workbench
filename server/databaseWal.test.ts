import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

test("both initialized databases use WAL and backup includes uncheckpointed writes", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "shenbi-wal-"));
  try {
    const moduleUrl = (name: string) => JSON.stringify(new URL(name, import.meta.url).href);
    const program = `
      import { Database } from 'bun:sqlite';
      import { mkdirSync } from 'node:fs';
      import { execFileSync } from 'node:child_process';
      import path from 'node:path';
      import { appDb, configDb } from ${moduleUrl("./db.ts")};
      import { initAppDb, initConfigDb } from ${moduleUrl("./schema.ts")};
      import { finishBackupJob } from ${moduleUrl("./backupCore.ts")};
      initAppDb(); initConfigDb();
      const root = ${JSON.stringify(directory)};
      for (const db of [appDb,configDb]) {
        if(db.query('pragma journal_mode').get().journal_mode !== 'wal') throw new Error('not WAL');
        if(db.query('pragma synchronous').get().synchronous !== 1) throw new Error('not NORMAL');
        db.exec("pragma wal_autocheckpoint = 0; create table wal_probe(value text); insert into wal_probe values ('uncheckpointed');");
      }
      const timestamp = new Date().toISOString();
      configDb.query('insert into backup_runs(id,source,status,backup_dir,file_name,started_at) values (?,?,?,?,?,?)')
        .run('test-backup','manual','running',path.join(root,'backups'),'test.tar',timestamp);
      const backup = await finishBackupJob({runId:'test-backup',source:'manual',backupDirValue:path.join(root,'backups'),retentionDays:30,startedAt:timestamp,fileName:'test.tar'});
      if(backup.status !== 'succeeded') throw new Error(backup.error);
      const restored = path.join(root,'restored'); mkdirSync(restored);
      execFileSync('tar',['-xf',path.join(root,'backups','test.tar'),'-C',restored]);
      for(const name of ['app.db','config.db']) {
        const db = new Database(path.join(restored,name));
        if(db.query('select value from wal_probe').get().value !== 'uncheckpointed') throw new Error('WAL data missing');
        db.close();
      }
      appDb.close(); configDb.close();
      console.log('wal-backup-restore-ok');
    `;
    const processHandle = Bun.spawn([process.execPath, "--eval", program], {
      env: { ...Bun.env, GPT_IMAGE_DATA_DIR: path.join(directory, "source"), GPT_IMAGE_APP_DB_PATH: path.join(directory, "source", "app.db"), GPT_IMAGE_CONFIG_DB_PATH: path.join(directory, "source", "config.db") },
      stdout: "pipe", stderr: "pipe"
    });
    const [stdout, stderr, exitCode] = await Promise.all([
      new Response(processHandle.stdout).text(), new Response(processHandle.stderr).text(), processHandle.exited
    ]);
    expect(stderr).toBe("");
    expect(exitCode).toBe(0);
    expect(stdout.trim()).toBe("wal-backup-restore-ok");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
