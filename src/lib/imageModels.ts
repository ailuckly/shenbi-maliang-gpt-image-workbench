export const IMAGE_MODEL_IDS = [
  "gpt-image-2.5-flare",
  "gpt-image-2.5-sunburst",
  "gpt-image-2"
] as const;

export type BuiltinImageModelId = (typeof IMAGE_MODEL_IDS)[number];
export type ImageModelId = string;

export const DEFAULT_GENERATION_IMAGE_MODEL: ImageModelId = "gpt-image-2.5-sunburst";
export const DEFAULT_EDIT_IMAGE_MODEL: ImageModelId = "gpt-image-2.5-sunburst";
export const IMAGE_MODEL_FALLBACK: ImageModelId = "gpt-image-2";
export const DEFAULT_IMAGE_QUALITY = "auto" as const;

export type ConversationImageSelection = {
  imageModel: ImageModelId;
  quality: ImageQuality;
};

export type ImageModelOption = {
  value: ImageModelId;
  labelKey: string;
  descriptionKey: string;
  shortLabelKey: string;
};

/** Gemini image models (chat route): low/high/max map to 1K/2K/4K output. */
export function isGeminiImageModel(model: unknown) {
  const normalized = String(model ?? "").trim().toLowerCase();
  return normalized.includes("gemini") && normalized.includes("image");
}

export function imageModelDisplayName(model: ImageModelId) {
  if (isGeminiImageModel(model)) {
    return model.replace(/^.*\//, "").split("-").map((part) => (/^\d/.test(part) ? part : part.charAt(0).toUpperCase() + part.slice(1))).join(" ");
  }
  if (model === "gpt-image-2.5-flare") return "GPT Image 2.5 Flare";
  if (model === "gpt-image-2.5-sunburst") return "GPT Image 2.5 Sunburst";
  return model === "gpt-image-2" ? "GPT Image 2" : model;
}

export const IMAGE_MODEL_OPTIONS: ImageModelOption[] = [
  {
    value: "gpt-image-2.5-flare",
    labelKey: "picker.model.flare",
    shortLabelKey: "picker.model.flareShort",
    descriptionKey: "picker.model.flareDesc"
  },
  {
    value: "gpt-image-2.5-sunburst",
    labelKey: "picker.model.sunburst",
    shortLabelKey: "picker.model.sunburstShort",
    descriptionKey: "picker.model.sunburstDesc"
  },
  {
    value: "gpt-image-2",
    labelKey: "picker.model.compatible",
    shortLabelKey: "picker.model.compatibleShort",
    descriptionKey: "picker.model.compatibleDesc"
  }
];

export const GPT_IMAGE_2_QUALITIES = ["low", "medium", "high"] as const;
export const GPT_IMAGE_25_QUALITIES = ["low", "medium", "high", "xhigh", "max"] as const;
export type ImageQuality = "auto" | (typeof GPT_IMAGE_25_QUALITIES)[number];

export function isImageModelId(value: unknown): value is BuiltinImageModelId {
  return IMAGE_MODEL_IDS.includes(String(value ?? "").trim() as BuiltinImageModelId);
}

export function normalizeImageModel(value: unknown, fallback: ImageModelId): ImageModelId {
  const normalized = String(value ?? "").trim();
  return normalized && normalized.length <= 256 && !/[\u0000-\u001f\u007f]/.test(normalized) ? normalized : fallback;
}

export function isGptImage25Model(value: unknown): value is Extract<BuiltinImageModelId, `gpt-image-2.5-${string}`> {
  return value === "gpt-image-2.5-flare" || value === "gpt-image-2.5-sunburst";
}

export const GEMINI_IMAGE_QUALITIES = ["low", "high", "max"] as const;

export function imageModelQualities(model: ImageModelId): ImageQuality[] {
  if (isGeminiImageModel(model)) return [...GEMINI_IMAGE_QUALITIES];
  return isImageModelId(model) ? [...(isGptImage25Model(model) ? GPT_IMAGE_25_QUALITIES : GPT_IMAGE_2_QUALITIES)] : [];
}

export function isImageQualitySupported(model: ImageModelId, quality: unknown) {
  const normalized = String(quality ?? "").trim().toLowerCase();
  return normalized === "auto" || imageModelQualities(model).includes(normalized as ImageQuality);
}

export function fallbackImageQuality(quality: unknown): ImageQuality {
  const normalized = String(quality ?? "").trim().toLowerCase();
  if (normalized === "auto") return "auto";
  return GPT_IMAGE_2_QUALITIES.includes(normalized as (typeof GPT_IMAGE_2_QUALITIES)[number])
    ? normalized as (typeof GPT_IMAGE_2_QUALITIES)[number]
    : "high";
}

export function normalizeImageQuality(model: ImageModelId, quality: unknown): ImageQuality {
  const normalized = String(quality ?? "").trim().toLowerCase();
  return isImageQualitySupported(model, normalized) ? normalized as ImageQuality : DEFAULT_IMAGE_QUALITY;
}

export function latestConversationImageSelection(messages: ReadonlyArray<{
  role?: string;
  metadata?: Record<string, unknown> | null;
}>): ConversationImageSelection | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.role !== "user" || typeof message.metadata?.model !== "string" || !message.metadata.model.trim()) continue;
    const imageModel = normalizeImageModel(message.metadata.model, DEFAULT_GENERATION_IMAGE_MODEL);
    return {
      imageModel,
      quality: normalizeImageQuality(imageModel, message.metadata.quality)
    };
  }
  return null;
}
