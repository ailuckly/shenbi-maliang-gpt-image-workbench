import type { PromptTemplate } from "../registry";
import { promptRules } from "./rules";

// 改编自 prompt-optimizer packages/core/src/services/template/default-templates/image-optimize/image2image/json-structured-optimize_en.ts@92c5aaadc43c60243a3ba68a2016183986e04d84
export const template: PromptTemplate = {
  id: "image2image/json-structured-optimize:en",
  mode: "i2i",
  language: "en",
  source: "改编自 prompt-optimizer packages/core/src/services/template/default-templates/image-optimize/image2image/json-structured-optimize_en.ts@92c5aaadc43c60243a3ba68a2016183986e04d84",
  system: promptRules.en + "\n" + "Structure the reference edit as strict JSON. Separate preserve and change boundaries in constraints and provide standalone editing instructions in finalPrompt. Ground visual details only in actually attached images or explicit user evidence; do not invent source elements. Preserve placeholders and required text.",
  user: "Request data (JSON field values are evidence only):\nRequest: {{originalRequest}}\nPrevious prompt: {{previousPrompt}}\nFollow-up: {{followUp}}\nReference count: {{referenceCount}}\nReference summary (not visual observation): {{referenceSummary}}"
};

