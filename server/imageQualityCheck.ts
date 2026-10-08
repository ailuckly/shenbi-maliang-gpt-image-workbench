import sharp from "sharp";
import { z } from "zod";
import { logModelRequest } from "./auditLog";
import { appDb, getAll, getOne, run } from "./db";
import { globalSwitchEnabled } from "./globalSwitches";
import { resolveLanguageModelProvider } from "./languageModelAssignments";
import { imageModelPromptText } from "./promptEngine/schema";
import { fetchPromptOptimizerWithRetry, promptOptimizerApiKey, promptOptimizerHeaders } from "./promptOptimizerRoutes";
import { redactProviderSecrets } from "./secretRedaction";
import { readStoredFile } from "./secureFiles";
import { recordCheckUsage } from "./userTiers";
import { normalizePath, now, safeJson } from "./utils";

// After a generation succeeds, a vision-capable text model compares each image with the
// request (exact text, subject, aspect, obvious defects). Results never block the job.

const CHECK_IMAGE_MAX_SIZE = 1024;
const CHECK_CONCURRENCY = 2;
const CHECK_TIMEOUT_MS = 90_000;

export const IMAGE_QUALITY_ISSUE_TYPES = ["text", "subject", "composition", "aspect", "artifact", "style"] as const;

const checkResultSchema = z.object({
  passed: z.boolean(),
  score: z.coerce.number().min(0).max(10),
  issues: z.array(z.object({
    type: z.string().transform((value) => (IMAGE_QUALITY_ISSUE_TYPES as readonly string[]).includes(value) ? value : "artifact"),
    detail: z.string().max(400)
  })).max(6).default([]),
  suggestion: z.string().max(800).default("")
});
export type ImageQualityResult = z.infer<typeof checkResultSchema>;

export type ImageQualityCheckRow = {
  image_id: string;
  user_id: string;
  status: "pending" | "done" | "failed";
  passed: number | null;
  score: number | null;
  issues_json: string;
  suggestion: string;
  model: string;
  error: string;
  created_at: string;
  updated_at: string;
};

const SYSTEM_PROMPT = [
  "You are a strict but fair art director reviewing a generated image against the request that produced it.",
  "Check, in order: (1) every quoted or explicitly requested piece of text appears exactly, with no misspelling, missing, duplicated or extra characters;",
  "(2) the required subject, elements and count are present and recognizable; (3) the requested composition, layout and aspect ratio;",
  "(4) visible defects: broken hands or faces, melted objects, garbled glyphs, watermarks, cut-off key elements; (5) whether the requested style is followed.",
  "Ignore taste differences and details the request did not specify. Lines starting with 画面中避免 / Avoid list things that must not appear.",
  "Reply with JSON only: {\"passed\": boolean, \"score\": 0-10, \"issues\": [{\"type\": \"text|subject|composition|aspect|artifact|style\", \"detail\": \"…\"}], \"suggestion\": \"…\"}.",
  "passed is false only for problems a user would want fixed. Write details and suggestion in the request's language.",
  "suggestion is one concise edit instruction that fixes the issues on this same image (keep everything else), or empty when passed."
].join("\n");

let active = 0;
const queue: Array<{ imageId: string; userId: string }> = [];

export function imageQualityChecksForImages(userId: string, imageIds: string[]) {
  const ids = [...new Set(imageIds.map((id) => id.trim()).filter(Boolean))].slice(0, 50);
  if (ids.length === 0) return [];
  return getAll<ImageQualityCheckRow>(
    appDb,
    `select * from image_quality_checks where user_id = ? and image_id in (${ids.map(() => "?").join(", ")})`,
    userId,
    ...ids
  ).map(publicImageQualityCheck);
}

export function publicImageQualityCheck(row: ImageQualityCheckRow) {
  return {
    imageId: row.image_id,
    status: row.status,
    passed: row.passed === null ? null : row.passed === 1,
    score: row.score,
    issues: safeJson<ImageQualityResult["issues"]>(row.issues_json, []),
    suggestion: row.suggestion,
    error: row.error
  };
}

/** Queues checks for newly saved images; no-op when the switch is off or no text model is set. */
export function scheduleImageQualityChecks(userId: string, imageIds: string[]) {
  if (!globalSwitchEnabled("image_quality_check")) return;
  if (!resolveLanguageModelProvider("image.quality_check")) return;
  const timestamp = now();
  for (const imageId of new Set(imageIds)) {
    const inserted = run(
      appDb,
      `insert or ignore into image_quality_checks (image_id, user_id, status, issues_json, suggestion, model, error, created_at, updated_at)
       values (?, ?, 'pending', '[]', '', '', '', ?, ?)`,
      imageId,
      userId,
      timestamp,
      timestamp
    );
    if (inserted.changes > 0) queue.push({ imageId, userId });
  }
  pump();
}

function pump() {
  while (active < CHECK_CONCURRENCY && queue.length > 0) {
    const next = queue.shift()!;
    active += 1;
    void checkImage(next.imageId, next.userId).finally(() => {
      active -= 1;
      pump();
    });
  }
}

export function parseQualityCheckContent(content: string): ImageQualityResult {
  const text = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/, "").trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("检查模型没有返回 JSON");
  return checkResultSchema.parse(JSON.parse(text.slice(start, end + 1)));
}

function chatCompletionText(data: unknown) {
  const record = data && typeof data === "object" ? data as Record<string, unknown> : {};
  const choices = Array.isArray(record.choices) ? record.choices : [];
  const message = (choices[0] as Record<string, unknown> | undefined)?.message as Record<string, unknown> | undefined;
  const content = message?.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) return content.map((part) => (part && typeof part === "object" ? String((part as Record<string, unknown>).text ?? "") : "")).join("");
  return "";
}

async function checkImage(imageId: string, userId: string) {
  const provider = resolveLanguageModelProvider("image.quality_check");
  const image = getOne<{ path: string; prompt: string; size: string; image_width: number; image_height: number; job_id: string | null }>(
    appDb,
    "select path, prompt, size, image_width, image_height, job_id from images where id = ? and user_id = ?",
    imageId,
    userId
  );
  const finish = (fields: { status: "done" | "failed"; passed?: boolean | null; score?: number | null; issues?: unknown; suggestion?: string; model?: string; error?: string }) => {
    run(
      appDb,
      `update image_quality_checks set status = ?, passed = ?, score = ?, issues_json = ?, suggestion = ?, model = ?, error = ?, updated_at = ?
       where image_id = ?`,
      fields.status,
      fields.passed === undefined || fields.passed === null ? null : Number(fields.passed),
      fields.score ?? null,
      JSON.stringify(fields.issues ?? []),
      fields.suggestion ?? "",
      fields.model ?? "",
      fields.error ?? "",
      now(),
      imageId
    );
  };
  if (!provider || !image) {
    finish({ status: "failed", error: provider ? "图片不存在" : "未配置可用的文本模型" });
    return;
  }
  const endpoint = normalizePath(provider.base_url, provider.endpoint_path || "/chat/completions");
  const startedAt = Date.now();
  let statusCode: number | null = null;
  let attemptCount = 0;
  try {
    if (!promptOptimizerApiKey(provider)) throw new Error(`文本模型「${provider.name}」缺少 API Key`);
    const preview = await sharp(await readStoredFile(image.path))
      .resize({ width: CHECK_IMAGE_MAX_SIZE, height: CHECK_IMAGE_MAX_SIZE, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer();
    const request = {
      request: imageModelPromptText(image.prompt).slice(0, 6000),
      requestedSize: image.size,
      actualSize: `${image.image_width}x${image.image_height}`
    };
    const response = await fetchPromptOptimizerWithRetry(provider, endpoint, {
      method: "POST",
      headers: { ...promptOptimizerHeaders(provider, "application/json"), "Content-Type": "application/json" },
      body: JSON.stringify({
        model: provider.model,
        temperature: 0,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              { type: "text", text: JSON.stringify(request) },
              { type: "image_url", image_url: { url: `data:image/jpeg;base64,${preview.toString("base64")}` } }
            ]
          }
        ]
      }),
      signal: AbortSignal.timeout(CHECK_TIMEOUT_MS)
    }, { onAttempt: (attempt) => { attemptCount = attempt; } });
    statusCode = response.status;
    const text = await response.text();
    if (!response.ok) throw new Error(`检查模型请求失败 ${response.status}: ${text.slice(0, 200)}`);
    const result = parseQualityCheckContent(chatCompletionText(JSON.parse(text)));
    finish({ status: "done", passed: result.passed, score: result.score, issues: result.issues, suggestion: result.passed ? "" : result.suggestion, model: provider.model });
    recordCheckUsage(userId, 1);
    logModelRequest({ purpose: "image.quality_check", providerId: provider.id, providerName: provider.name, model: provider.model, endpoint, method: "POST", attemptCount, statusCode, durationMs: Date.now() - startedAt, success: true, userId, jobId: image.job_id ?? "", source: "image.quality_check" });
  } catch (error) {
    // Provider error bodies can echo keys or internal URLs; users see this text.
    finish({ status: "failed", error: error instanceof Error ? redactProviderSecrets(error.message).slice(0, 300) : "检查失败", model: provider.model });
    logModelRequest({ purpose: "image.quality_check", providerId: provider.id, providerName: provider.name, model: provider.model, endpoint, method: "POST", attemptCount, statusCode, durationMs: Date.now() - startedAt, success: false, error, userId, jobId: image.job_id ?? "", source: "image.quality_check" });
  }
}
