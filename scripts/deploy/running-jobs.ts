// Prints how many image jobs are still running, so a deploy can wait before restarting.
// Usage: bun scripts/deploy/running-jobs.ts /srv/shenbi/data/app.db
import { Database } from "bun:sqlite";

const file = process.argv[2];
try {
  const db = new Database(file, { readonly: true });
  const row = db.query("select count(*) as count from image_jobs where status = 'running'").get() as { count: number } | null;
  console.log(row?.count ?? 0);
} catch {
  console.log(0);
}
