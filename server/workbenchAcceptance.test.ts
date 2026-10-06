import { Database } from "bun:sqlite";
import { expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";

async function until(check: () => boolean | Promise<boolean>) {
  const deadline = Date.now() + 10_000;
  while (!(await check())) {
    if (Date.now() > deadline) throw new Error("Acceptance condition timed out");
    await Bun.sleep(20);
  }
}

async function productionServer(directory: string) {
  let origin = "";
  let stderr = "";
  const entry = JSON.stringify(new URL("./index.ts", import.meta.url).href);
  const child = Bun.spawn([process.execPath, "--eval", `await import(${entry});console.log('TEST_READY:'+globalThis.__gptImageServer.url.origin);`], {
    cwd: path.resolve(import.meta.dir, ".."),
    env: {
      ...Bun.env, HOST: "127.0.0.1", PORT: "0", NODE_ENV: "production", APP_COOKIE_SECURE: "false", APP_TRUST_PROXY: "false",
      GPT_IMAGE_DATA_DIR: directory,
      GPT_IMAGE_APP_DB_PATH: path.join(directory, "app.db"),
      GPT_IMAGE_CONFIG_DB_PATH: path.join(directory, "config.db")
    },
    stdout: "pipe", stderr: "pipe"
  });
  const drain = (async () => {
    let output = "";
    const reader = child.stdout.getReader();
    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      output += decoder.decode(value, { stream: true });
      origin = output.match(/TEST_READY:(http:\/\/[^\s]+)/)?.[1] ?? "";
    }
  })();
  const errors = (async () => { stderr = await new Response(child.stderr).text(); })();
  const stop = async () => { child.kill("SIGKILL"); await child.exited; await Promise.all([drain, errors]); };
  try { await until(() => Boolean(origin)); } catch (error) { await stop(); throw new Error(`${error}; ${stderr}`); }
  return { origin, stop };
}

async function request(origin: string, route: string, method = "GET", body?: unknown, cookie = "") {
  return fetch(origin + "/api" + route, {
    method, headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });
}

function cookieOf(response: Response) {
  return response.headers.get("set-cookie")!.split(";")[0]!;
}

async function setupAccounts(origin: string) {
  expect((await request(origin, "/config/auth/setup", "POST", { password: "test-only-admin" })).status).toBe(200);
  const admin = cookieOf(await request(origin, "/config/auth/login", "POST", { password: "test-only-admin" }));
  const users: Array<{ id: string; cookie: string }> = [];
  for (const account of ["test-a", "test-b"]) {
    const created = await request(origin, "/config/users", "POST", { account, username: account, password: "test-only-user" }, admin);
    expect(created.status).toBe(200);
    const { user } = await created.json() as { user: { id: string } };
    const login = await request(origin, "/auth/login", "POST", { account, password: "test-only-user" });
    expect(login.status).toBe(200);
    users.push({ id: user.id, cookie: cookieOf(login) });
  }
  return { admin, users };
}

test("production restart never resubmits in-flight work, retains saved slots, and manual retry only fills the missing slot", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "shenbi-restart-test-"));
  const png = await sharp({ create: { width: 8, height: 8, channels: 3, background: "white" } }).png().toBuffer();
  let calls = 0;
  let heldCall = 2;
  const pending: Array<(response: Response) => void> = [];
  const provider = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: async req => {
    expect(new URL(req.url).pathname).toBe("/v1/images/generations");
    await req.json();
    calls += 1;
    if (calls === heldCall) return new Promise<Response>(resolve => pending.push(resolve));
    return Response.json({ data: [{ b64_json: png.toString("base64") }] });
  } });
  let server: Awaited<ReturnType<typeof productionServer>> | undefined;
  let app: Database | undefined;
  let config: Database | undefined;
  try {
    server = await productionServer(directory);
    const { admin, users } = await setupAccounts(server.origin);
    const user = users[0]!;
    expect((await request(server.origin, "/config/image-mode", "PUT", { mode: "api", resultRetryCount: 0, multiImageConcurrency: 1 }, admin)).status).toBe(200);
    expect((await request(server.origin, "/config/providers", "PUT", { providers: [{
      id: "test-only-image", name: "Test-only loopback supplier", channel: "api", type: "openai-compatible", enabled: true,
      baseUrl: provider.url.origin, apiKeyEnv: "", apiKeyValue: "", routeMode: "images_api", model: "gpt-image-2",
      generationPath: "/v1/images/generations", editPath: "/v1/images/edits", defaultQuality: "auto"
    }] }, admin)).status).toBe(200);
    const response = await request(server.origin, "/images/generate", "POST", { prompt: "test-only plain white square", n: 2, clientRequestId: "test-only-restart" }, user.cookie);
    expect(response.status).toBe(202);
    const generated = await response.json() as { job: { id: string }; sessionId: string };
    app = new Database(path.join(directory, "app.db"));
    config = new Database(path.join(directory, "config.db"));
    const images = () => app!.query("select id,path,job_image_index from images where job_id=? order by job_image_index").all(generated.job.id) as Array<{ id: string; path: string; job_image_index: number }>;
    const job = () => app!.query("select status,error,manual_retry_count,recovery_count from image_jobs where id=?").get(generated.job.id) as { status: string; error: string; manual_retry_count: number; recovery_count: number };
    await until(() => calls === 2 && images().length === 1);
    const first = images()[0]!;
    const before = { calls, logs: config.query("select count(*) as n from provider_request_logs where job_id=?").get(generated.job.id) as { n: number } };
    await server.stop();
    server = await productionServer(directory);
    await until(() => job().status !== "running");
    const after = { calls, job: job(), images: images().length, logs: config.query("select count(*) as n from provider_request_logs where job_id=?").get(generated.job.id) as { n: number } };
    if (Bun.env.SHENBI_RESTART_EVIDENCE_PATH) await writeFile(Bun.env.SHENBI_RESTART_EVIDENCE_PATH, JSON.stringify({ environment: "isolated production server with test-only loopback supplier", before, after, restartSubmissions: after.calls - before.calls }, null, 2) + "\n");
    expect(after.calls - before.calls).toBe(0);
    expect(after.logs.n).toBe(before.logs.n);
    expect(after.job.status).toBe("failed");
    expect(after.job.error).toContain("手动重试");
    expect(images()).toEqual([first]);
    expect((await fetch(server.origin + "/api/files/images/" + first.id, { headers: { cookie: user.cookie } })).status).toBe(200);
    expect((await request(server.origin, "/image-jobs/" + generated.job.id + "/retry", "POST", {}, user.cookie)).status).toBe(202);
    await until(() => job().status === "succeeded");
    expect(calls).toBe(before.calls + 1);
    expect(images().map(i => i.job_image_index)).toEqual([1, 2]);
    expect(images()[0]).toEqual(first);
    expect(job().manual_retry_count).toBe(1);
    heldCall = calls + 2;
    const cancelResponse = await request(server.origin, "/images/generate", "POST", { prompt: "test-only cancellation", n: 2, clientRequestId: "test-only-cancel" }, user.cookie);
    expect(cancelResponse.status).toBe(202);
    const cancelled = await cancelResponse.json() as { job: { id: string }; sessionId: string };
    const cancelImages = () => app!.query("select id from images where job_id=?").all(cancelled.job.id);
    await until(() => calls === heldCall && cancelImages().length === 1);
    const cancelBody = { jobId: cancelled.job.id, clientRequestId: "test-only-cancel" };
    const cancelResult = await request(server.origin, "/image-jobs/cancel", "POST", cancelBody, user.cookie);
    expect(cancelResult.status).toBe(200);
    expect(await cancelResult.json()).toMatchObject({ preservedImageCount: 1, sessionDeleted: false, status: "cancelled" });
    expect(cancelImages().length).toBe(1);
    expect((app.query("select status,result_image_id from image_jobs where id=?").get(cancelled.job.id) as { status: string; result_image_id: string }).status).toBe("cancelled");
    expect((app.query("select result_image_id from image_jobs where id=?").get(cancelled.job.id) as { result_image_id: string }).result_image_id).toBeTruthy();
    expect((await request(server.origin, "/image-jobs/cancel", "POST", cancelBody, user.cookie)).status).toBe(200);
    expect(cancelImages().length).toBe(1);
    // Simulate a crash after all files were saved but before the terminal DB update.
    app.query("update image_jobs set status='running' where id=?").run(generated.job.id);
    await server.stop();
    const completeCalls = calls;
    server = await productionServer(directory);
    await until(() => job().status === "succeeded");
    expect(calls).toBe(completeCalls);
    expect(images().length).toBe(2);
    expect(cancelImages().length).toBe(1);
    if (Bun.env.SHENBI_RESTART_EVIDENCE_PATH) await writeFile(Bun.env.SHENBI_RESTART_EVIDENCE_PATH, JSON.stringify({
      environment: "isolated production server with test-only loopback supplier", before, after,
      restartSubmissions: after.calls - before.calls,
      manualRetrySubmissions: 1, manualRetrySlots: [1, 2], cancelledPreservedImages: cancelImages().length,
      completedAndCancelledRestartSubmissions: calls - completeCalls
    }, null, 2) + "\n");
  } finally {
    await server?.stop();
    for (const resolve of pending) resolve(new Response(null, { status: 499 }));
    provider.stop(true);
    app?.close(); config?.close();
    await rm(directory, { recursive: true, force: true });
  }
}, 30_000);
