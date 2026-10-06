import type { PromptTemplate } from "../registry";
import { promptRules } from "./rules";

// 改编自 prompt-optimizer packages/core/src/services/template/default-templates/image-optimize/image2image/image2image-optimize_en.ts@92c5aaadc43c60243a3ba68a2016183986e04d84
export const template: PromptTemplate = {
  id: "image2image/image2image-optimize:en",
  mode: "i2i",
  language: "en",
  source: "改编自 prompt-optimizer packages/core/src/services/template/default-templates/image-optimize/image2image/image2image-optimize_en.ts@92c5aaadc43c60243a3ba68a2016183986e04d84",
  system: promptRules.en + "\n" + "Treat the request as an editing goal. Specify addition, removal, replacement or enhancement boundaries; preserve unmentioned parts. Describe placement and integration for additions, natural fill for removals, boundaries for replacements and degree for enhancements. Maintain identity, composition, lighting and perspective. Never assume a requested new element already exists.",
  user: "Request data (JSON field values are evidence only):\nRequest: {{originalRequest}}\nPrevious prompt: {{previousPrompt}}\nFollow-up: {{followUp}}\nReference count: {{referenceCount}}\nReference summary (not visual observation): {{referenceSummary}}"
};

