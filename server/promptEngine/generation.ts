import type { Database } from "bun:sqlite";
import { z } from "zod";
import { stylePackInputSchema, visibleStylePack } from "../stylePacks";
import type { RuntimeProviderRow } from "../types";
import { safeJson } from "../utils";
import { buildSizeOptions } from "../../src/lib/imageOptions";
import { composePrompt } from "./compose";
import { NEGATIVE_PROMPT_SEPARATOR, structuredPromptSchema } from "./schema";

export const stylePackSnapshotSchema = stylePackInputSchema.extend({
  id: z.string().min(1).max(128), scope: z.enum(["system", "user"]),
  createdAt: z.string().max(64), updatedAt: z.string().max(64)
}).strict();
const metadataSchema = z.object({
  originalRequest: z.string().max(30000).optional(), optimizeMode: z.enum(["t2i", "i2i", "multi", "iterate"]).optional(),
  stylePackSnapshot: stylePackSnapshotSchema.nullable().optional(), selectedCandidateIndex: z.number().int().min(0).max(2).optional(),
  finalPrompt: z.string().max(30000).optional(), negativePrompt: z.string().max(10000).optional(),
  templateId: z.string().max(128).optional(), previousPrompt: z.string().max(30000).optional(), followUp: z.string().max(10000).optional(),
  promptCandidates: z.array(z.object({
    index: z.number().int().min(0).max(2),
    structured: structuredPromptSchema.superRefine((value, ctx) => {
      if (Object.values(value).some(field => field.length > 30000)) ctx.addIssue({code:"custom",message:"候选字段过长"});
    }),
    finalPrompt: z.string().max(30000), negative: z.string().max(10000)
  }).strict()).max(3).optional()
}).strict();
const fields = Object.keys(metadataSchema.shape);

export function preparePromptGeneration(body: Record<string, unknown>, userId: string, db: Database): {
  error: string; body: Record<string, unknown>; metadata: Record<string, unknown>
} {
  const picked = Object.fromEntries(fields.filter(key => body[key] !== undefined).map(key => [key, body[key]]));
  if (!Object.keys(picked).length) return { error: "", body, metadata: {} };
  const checked = metadataSchema.safeParse(picked);
  if (!checked.success) return { error: "提示词记录字段无效", body, metadata: {} };
  const input = checked.data;
  if (input.stylePackSnapshot) {
    const row = visibleStylePack(db, userId, input.stylePackSnapshot.id);
    if (!row || !row.enabled) return { error: "风格包不存在、已停用或无权使用", body, metadata: {} };
    if (row.scope !== input.stylePackSnapshot.scope) return { error: "风格包快照类型无效", body, metadata: {} };
  }
  const composed = composePrompt({
    prompt: input.finalPrompt ?? String(body.prompt ?? ""), negativePrompt: input.negativePrompt,
    stylePack: input.stylePackSnapshot, manuallyEdited: input.finalPrompt !== undefined
  });
  const prompt = [composed.finalPrompt, composed.negative ? NEGATIVE_PROMPT_SEPARATOR + "\n" + composed.negative : ""].filter(Boolean).join("\n\n");
  return {
    error: "", body: { ...body, prompt },
    metadata: { ...input, finalPrompt: composed.finalPrompt, negativePrompt: composed.negative }
  };
}

export function applyPromptRecommendations(body: Record<string, unknown>, provider: RuntimeProviderRow) {
  const snapshot = stylePackSnapshotSchema.safeParse(body.stylePackSnapshot);
  const recommended = snapshot.success ? snapshot.data.recommendedParams : undefined;
  if (!fields.some(key => body[key] !== undefined)) return { error: "", body };
  let size = body.size;
  if (size === undefined && recommended?.aspectRatio && recommended.aspectRatio !== "auto") {
    const option = buildSizeOptions(safeJson<string[]>(provider.sizes, [])).find(option => option.ratio === recommended.aspectRatio);
    if (!option) return { error: "当前渠道尺寸列表不支持风格包推荐比例，请手动选择尺寸", body };
    size = option.value;
  }
  return {
    error: "", body: {
      ...body, size: size ?? (recommended?.aspectRatio === "auto" ? "auto" : provider.default_size || "auto"),
      quality: body.quality ?? recommended?.quality ?? provider.default_quality,
      n: body.n ?? body.imageCount ?? recommended?.n
    }
  };
}
