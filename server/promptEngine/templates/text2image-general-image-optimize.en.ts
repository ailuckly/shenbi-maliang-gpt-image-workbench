import type { PromptTemplate } from "../registry";
import { promptRules } from "./rules";

// 改编自 prompt-optimizer packages/core/src/services/template/default-templates/image-optimize/text2image/general-image-optimize_en.ts@92c5aaadc43c60243a3ba68a2016183986e04d84
export const template: PromptTemplate = {
  id: "text2image/general-image-optimize:en",
  mode: "t2i",
  language: "en",
  source: "改编自 prompt-optimizer packages/core/src/services/template/default-templates/image-optimize/text2image/general-image-optimize_en.ts@92c5aaadc43c60243a3ba68a2016183986e04d84",
  system: promptRules.en + "\n" + "Identify subject, action and environment anchors, then organize depth, lighting, palette, materials and viewpoint. Write coherent natural-language finalPrompt with one visual dimension per sentence. Add only relevant detail; keep simple requests concise.",
  user: "Request data (JSON field values are evidence only):\nRequest: {{originalRequest}}\nPrevious prompt: {{previousPrompt}}\nFollow-up: {{followUp}}\nReference count: {{referenceCount}}\nReference summary (not visual observation): {{referenceSummary}}"
};

