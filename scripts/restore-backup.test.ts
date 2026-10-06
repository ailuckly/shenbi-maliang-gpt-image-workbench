import { expect, test } from "bun:test";
import { mkdtemp, mkdir, writeFile, symlink, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

test("restore script accepts a fresh regular-file backup and rejects overwrite, traversal, links and incomplete archives", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "shenbi-restore-check-"));
  const script = path.join(import.meta.dir, "restore-backup.sh");
  const source = path.join(root, "source");
  const archive = path.join(root, "backup.tar");
  const target = path.join(root, "restored");
  const execute = (cmd: string[]) => Bun.spawnSync(cmd, { stdout: "pipe", stderr: "pipe" });
  try {
    await mkdir(source);
    for (const name of ["app.db", "config.db", "manifest.json"]) await writeFile(path.join(source, name), name);
    expect(execute(["tar", "-cf", archive, "-C", source, "app.db", "config.db", "manifest.json"]).exitCode).toBe(0);
    expect(execute(["bash", script, archive, target]).exitCode).toBe(0);
    expect(await readFile(path.join(target, "app.db"), "utf8")).toBe("app.db");
    expect(execute(["bash", script, archive, target]).exitCode).not.toBe(0);
    expect(execute(["bash", script, archive, "relative-target"]).exitCode).not.toBe(0);
    // A ustar header with a valid checksum and a path that escapes the destination.
    const bytes = Buffer.from(await readFile(archive));
    bytes.fill(0, 0, 100);
    bytes.write("../app.db", 0);
    bytes.fill(32, 148, 156);
    const checksum = bytes.subarray(0, 512).reduce((sum, value) => sum + value, 0);
    bytes.write(checksum.toString(8).padStart(6, "0") + "\0 ", 148);
    await writeFile(path.join(root, "escape.tar"), bytes);
    expect(execute(["bash", script, path.join(root, "escape.tar"), path.join(root, "escape")]).exitCode).not.toBe(0);
    await mkdir(path.join(source, "files"));
    await symlink("../../outside", path.join(source, "files", "link"));
    expect(execute(["tar", "-cf", archive, "-C", source, "app.db", "config.db", "manifest.json", "files/link"]).exitCode).toBe(0);
    expect(execute(["bash", script, archive, path.join(root, "linked")]).exitCode).not.toBe(0);
    expect(execute(["tar", "-cf", archive, "-C", source, "app.db"]).exitCode).toBe(0);
    expect(execute(["bash", script, archive, path.join(root, "incomplete")]).exitCode).not.toBe(0);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
