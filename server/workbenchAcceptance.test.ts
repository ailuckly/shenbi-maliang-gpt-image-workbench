import { Database } from "bun:sqlite";
import { expect, test } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import { maskSecret } from "./utils";

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

test("production account/file/share isolation, server-only credentials, and configuration snapshots", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "shenbi-isolation-test-"));
  const png = await sharp({ create: { width: 8, height: 8, channels: 3, background: "white" } }).png().toBuffer();
  const key = 'test-only-key-"quoted\\sentinel';
  let reject = false;
  const models: string[] = [];
  const provider = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: async req => {
    const route = new URL(req.url).pathname;
    if (reject) return Response.json({ error: { message: "Rejected " + req.headers.get("authorization")?.replace("Bearer ", "") } }, { status: 401 });
    if (route === "/v1/models") return Response.json({ data: [{ id: "test-only-text" }] });
    const body = route.endsWith("/edits") ? Object.fromEntries(await req.formData()) : await req.json() as Record<string, unknown>;
    models.push(String(body.model));
    return Response.json({ data: [{ b64_json: png.toString("base64") }] });
  } });
  let server: Awaited<ReturnType<typeof productionServer>> | undefined;
  let app: Database | undefined;
  let config: Database | undefined;
  let denied = 0;
  let safeResponses = 0;
  try {
    server = await productionServer(directory);
    const { origin } = server;
    const { admin, users } = await setupAccounts(origin);
    const [a, b] = users as [typeof users[number], typeof users[number]];
    app = new Database(path.join(directory, "app.db"));
    config = new Database(path.join(directory, "config.db"));
    // A user flag must never grant a standalone config session.
    app.query("update users set has_config_access=1 where id=?").run(b.id);
    const channel = { id: "test-only-image", name: "Test-only supplier", channel: "api", type: "openai-compatible", enabled: true,
      baseUrl: provider.url.origin, apiKeyEnv: "", apiKeyValue: key, routeMode: "images_api", model: "gpt-image-2",
      generationPath: "/v1/images/generations", editPath: "/v1/images/edits", defaultQuality: "auto" };
    expect((await request(origin, "/config/image-mode", "PUT", { mode: "api", resultRetryCount: 0 }, admin)).status).toBe(200);
    expect((await request(origin, "/config/providers", "PUT", { providers: [channel] }, admin)).status).toBe(200);
    const safe = async (response: Response) => {
      const data: unknown = await response.json();
      expect(JSON.stringify(data)).not.toContain(JSON.stringify(key).slice(1, -1));
      safeResponses++;
      return data;
    };
    await safe(await request(origin, "/config/providers", "GET", undefined, admin));
    const reveal = await request(origin, "/config/providers/test-only-image/api-key", "GET", undefined, admin);
    expect(reveal.status).toBe(410); await safe(reveal);
    const accountResponse = await request(origin, "/config/image-accounts", "POST", { name: "Test-only account", accessToken: key, authJson: JSON.stringify({ access_token: key }) }, admin);
    expect(accountResponse.status).toBe(200);
    const account = (await safe(accountResponse) as { account: { id: string; accessToken: string; authJson: string } }).account;
    const accountDetail = await request(origin, "/config/image-accounts/" + account.id, "GET", undefined, admin);
    expect(accountDetail.status).toBe(200); await safe(accountDetail);
    expect(account.accessToken).toBe("******"); expect(account.authJson).toBe("******");
    expect((await request(origin, "/config/image-accounts/" + account.id, "PATCH", { ...account, name: "Test-only renamed" }, admin)).status).toBe(200);
    expect((config.query("select access_token from image_accounts where id=?").get(account.id) as { access_token: string }).access_token).toBe(key);
    // Old logs may store a nested serialized response; redact both encoded and plain representations.
    config.query("insert into config_audit_logs(id,action,detail,created_at) values(?,?,?,?)").run("test-only-legacy-log", "test-only-legacy", JSON.stringify({ snapshot: JSON.stringify({ message: key }), url: "https://test.invalid/?k=" + encodeURIComponent(key) }), new Date().toISOString());
    expect(maskSecret("test-only-****-sentinel")).toBe("******");
    expect(maskSecret(key)).toBe("******");
    const upload = async (cookie: string, name: string) => {
      const form = new FormData(); form.set("file", new File([png], name, { type: "image/png" })); form.set("spaceMode", "private");
      const response = await fetch(origin + "/api/assets/upload", { method: "POST", headers: { cookie }, body: form });
      expect(response.status).toBe(200);
      return (await response.json() as { asset: { id: string } }).asset.id;
    };
    const pack = (await (await request(origin, "/style-packs", "POST", { name: "Test-only private A", groupKey: "test", promptPrefix: "studio" }, a.cookie)).json() as { stylePack: { id: string } }).stylePack;
    const system = (await (await request(origin, "/style-packs", "GET", undefined, a.cookie)).json() as { stylePacks: Array<Record<string, unknown>> }).stylePacks.find(p => p.scope === "system")!;
    const generate = async (cookie: string, snapshot?: unknown) => {
      const response = await request(origin, "/images/generate", "POST", { prompt: "test-only product", n: 1, originalRequest: "test-only request", ...(snapshot ? { stylePackSnapshot: snapshot } : {}) }, cookie);
      expect(response.status).toBe(202);
      const result = await response.json() as { job: { id: string }; sessionId: string };
      await until(() => (app!.query("select status from image_jobs where id=?").get(result.job.id) as { status: string }).status === "succeeded");
      const image = app!.query("select id from images where job_id=?").get(result.job.id) as { id: string };
      return { ...result, imageId: image.id };
    };
    const ga = await generate(a.cookie, system), gb = await generate(b.cookie);
    const aa = await upload(a.cookie, "test-only-a.png"), ab = await upload(b.cookie, "test-only-b.png");
    const oldMessages = app.query("select id,role,metadata from messages where session_id=? order by rowid").all(ga.sessionId) as Array<{ id: string; role: string; metadata: string }>;
    const edit = await request(origin, "/images/edit", "POST", { prompt: "test-only edit", sessionId: ga.sessionId, sourceImageIds: [ga.imageId], sourceAssetIds: [aa], n: 1 }, a.cookie);
    expect(edit.status).toBe(202);
    const ej = await edit.json() as { job: { id: string } };
    await until(() => (app!.query("select status from image_jobs where id=?").get(ej.job.id) as { status: string }).status === "succeeded");
    const refs = app.query("select id from message_source_references where user_id=?").all(a.id) as Array<{ id: string }>;
    const imageRefs = app.query("select id from image_asset_references where user_id=?").all(a.id) as Array<{ id: string }>;
    expect(refs.length).toBeGreaterThan(0); expect(imageRefs.length).toBeGreaterThan(0);
    const deny = async (route: string, cookie: string, method = "GET", body?: unknown, status = 404) => {
      expect((await request(origin, route, method, body, cookie)).status).toBe(status); denied++;
    };
    for (const [own, other, g, asset] of [[a, b, ga, aa], [b, a, gb, ab]] as const) {
      for (const route of ["/sessions/" + g.sessionId, "/sessions/" + g.sessionId + "/messages", "/image-jobs/" + g.job.id, "/images/" + g.imageId, "/assets/" + asset]) {
        expect((await request(origin, route, "GET", undefined, own.cookie)).status).toBe(200);
        await deny(route, other.cookie); await deny(route, admin, "GET", undefined, 401);
      }
      for (const file of ["images/" + g.imageId, "assets/" + asset]) for (const variant of ["original", "preview", "thumb"]) {
        const route = "/files/" + file + "?variant=" + variant;
        expect((await request(origin, route, "GET", undefined, own.cookie)).status).toBe(200);
        await deny(route, other.cookie); await deny(route, admin);
      }
      await deny("/sessions/" + g.sessionId + "/title", other.cookie, "PATCH", { title: "stolen" });
      await deny("/sessions/" + g.sessionId, other.cookie, "DELETE");
      await deny("/images/" + g.imageId, other.cookie, "DELETE");
      await deny("/assets/" + asset, other.cookie, "PATCH", { name: "stolen" });
      await deny("/assets/" + asset, other.cookie, "DELETE", undefined, 403);
      const before = models.length;
      await deny("/images/edit", other.cookie, "POST", { prompt: "test-only cross edit", sourceImageIds: [g.imageId] });
      await deny("/images/edit", other.cookie, "POST", { prompt: "test-only cross edit", sourceAssetIds: [asset] });
      expect(models.length).toBe(before);
    }
    for (const ref of refs) await deny("/files/message-source-references/" + ref.id, b.cookie);
    for (const ref of imageRefs) await deny("/files/image-references/" + ref.id, b.cookie);
    expect(JSON.stringify(await (await request(origin, "/style-packs", "GET", undefined, b.cookie)).json())).not.toContain(pack.id);
    await deny("/style-packs/" + pack.id, b.cookie, "PATCH", { name: "stolen" });
    await deny("/style-packs/" + pack.id, b.cookie, "DELETE");
    await deny("/style-packs/preview", b.cookie, "POST", { prompt: "test", stylePackId: pack.id });
    for (const u of [a, b]) for (const route of ["/config/providers", "/config/users", "/config/style-packs", "/config/request-logs", "/config/prompt-optimizer-providers", "/config/providers/test-only-image/api-key"]) await deny(route, u.cookie, "GET", undefined, 401);
    const shareResponse = await request(origin, "/sessions/" + ga.sessionId + "/share-links", "POST", { messageIds: oldMessages.map(m => m.id), includeBranches: false }, a.cookie);
    expect(shareResponse.status).toBe(200);
    const share = (await shareResponse.json() as { shareLink: { id: string; path: string } }).shareLink;
    const token = share.path.split("/").at(-1)!;
    const sharedRoute = "/shared-sessions/" + token;
    const publicResponse = await request(origin, sharedRoute);
    expect(publicResponse.status).toBe(200);
    const shared = await publicResponse.json() as { messages: Array<{ id: string; imageOriginalUrl?: string }> };
    expect(shared.messages.length).toBe(oldMessages.length);
    expect(JSON.stringify(shared)).not.toContain(ga.imageId);
    const download = shared.messages.find(m => m.imageOriginalUrl)!.imageOriginalUrl!;
    expect((await fetch(origin + download)).status).toBe(200);
    await deny(sharedRoute + "/messages/" + oldMessages[1]!.id + "/image", "");
    await deny(sharedRoute + "/messages/shared-message-3/image", "");
    expect((await request(origin, "/session-share-links/" + share.id, "DELETE", undefined, a.cookie)).status).toBe(200);
    await deny(sharedRoute, ""); expect((await fetch(origin + download)).status).toBe(404);
    // Admin changes only affect subsequent jobs; existing prompt/model snapshots remain byte-for-byte intact.
    expect((await request(origin, "/config/style-packs/" + system.id, "PATCH", { name: "Test-only changed", promptPrefix: "new studio" }, admin)).status).toBe(200);
    expect((await request(origin, "/config/providers", "PUT", { providers: [{ ...channel, model: "gpt-image-2.5-sunburst" }] }, admin)).status).toBe(200);
    const updated = (await (await request(origin, "/style-packs", "GET", undefined, a.cookie)).json() as { stylePacks: Array<Record<string, unknown>> }).stylePacks.find(p => p.id === system.id)!;
    await generate(a.cookie, updated);
    expect(models.at(-1)).toBe("gpt-image-2.5-sunburst");
    for (const row of oldMessages) expect((app.query("select metadata from messages where id=?").get(row.id) as { metadata: string }).metadata).toBe(row.metadata);
    reject = true;
    const textProvider = { id: "test-only-text", name: "Test-only text", enabled: true, baseUrl: provider.url.origin, endpointPath: "/v1/chat/completions", apiKeyEnv: "", apiKeyValue: key, model: "test-only-text", retryCount: 0, streamEnabled: true };
    expect((await request(origin, "/config/prompt-optimizer-providers", "PUT", { providers: [textProvider] }, admin)).status).toBe(200);
    expect((await request(origin, "/config/language-model-assignments", "PUT", { globalDefault: { providerId: textProvider.id, model: textProvider.model }, assignments: [] }, admin)).status).toBe(200);
    const optimize = await request(origin, "/prompt-optimizer/optimize", "POST", { prompt: "test-only optimize", mode: "t2i", candidates: 2 }, a.cookie);
    expect(optimize.status).toBe(200); expect(optimize.headers.get("content-type")).toContain("text/event-stream");
    const events = await optimize.text(); expect(events).toContain("event: error"); expect(events).not.toContain(JSON.stringify(key).slice(1, -1)); safeResponses++;
    for (const route of ["models", "test"]) {
      const probe = await request(origin, "/config/prompt-optimizer-providers/" + route, "POST", textProvider, admin);
      expect(probe.status).toBe(400); await safe(probe);
    }
    const unsaved = await request(origin, "/config/prompt-optimizer-providers/test", "POST", { ...textProvider, id: "test-only-unsaved", apiKeyValue: "test-only-unsaved-key" }, admin);
    expect(unsaved.status).toBe(400); expect(JSON.stringify(await unsaved.json())).not.toContain("test-only-unsaved-key"); safeResponses++;
    const failure = await request(origin, "/images/generate", "POST", { prompt: "test-only failure", n: 1 }, a.cookie);
    expect(failure.status).toBe(202);
    const failedJob = await failure.json() as { job: { id: string } };
    await until(() => (app!.query("select status from image_jobs where id=?").get(failedJob.job.id) as { status: string }).status === "failed");
    await safe(await request(origin, "/image-jobs/" + failedJob.job.id, "GET", undefined, a.cookie));
    for (const route of ["/config/providers", "/config/prompt-optimizer-providers", "/config/request-logs", "/config/model-request-logs", "/config/audit"]) await safe(await request(origin, route, "GET", undefined, admin));
    for (const table of ["provider_request_logs", "model_request_logs"]) expect(JSON.stringify(config.query(`select error from ${table}`).all())).not.toContain(JSON.stringify(key).slice(1, -1));
    expect(JSON.stringify(app.query("select error from image_jobs").all())).not.toContain(JSON.stringify(key).slice(1, -1));
    if (Bun.env.SHENBI_ISOLATION_EVIDENCE_PATH) await writeFile(Bun.env.SHENBI_ISOLATION_EVIDENCE_PATH, JSON.stringify({ environment: "isolated production server with test-only loopback supplier", users: 2, adminSessions: 1, deniedRequests: denied, checkedSafeJsonAndSseResponses: safeResponses, fileVariants: ["original", "preview", "thumb"], shareScopeAndRevocation: "passed", subsequentModelChange: "passed", previousSnapshotsUnchanged: true, persistedErrorsRedacted: true }, null, 2) + "\n");
  } finally {
    await server?.stop(); provider.stop(true); app?.close(); config?.close(); await rm(directory, { recursive: true, force: true });
  }
}, 30_000);
