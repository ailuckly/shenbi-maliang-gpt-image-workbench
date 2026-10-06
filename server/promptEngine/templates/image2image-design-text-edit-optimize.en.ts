import type { PromptTemplate } from "../registry";
import { promptRules } from "./rules";

// 改编自 prompt-optimizer packages/core/src/services/template/default-templates/image-optimize/image2image/design-text-edit-optimize_en.ts@92c5aaadc43c60243a3ba68a2016183986e04d84
export const template: PromptTemplate = {
  id: "image2image/design-text-edit-optimize:en",
  mode: "i2i",
  language: "en",
  source: "改编自 prompt-optimizer packages/core/src/services/template/default-templates/image-optimize/image2image/design-text-edit-optimize_en.ts@92c5aaadc43c60243a3ba68a2016183986e04d84",
  system: promptRules.en + "\n" + "Map original text to replacement copy precisely. Replace specified text only; preserve palette, font, weight, spacing, hierarchy, alignment, grid, whitespace, icons and background. For overflow prefer a modest font-size reduction over layout changes or extra decoration. Maintain readability and brand consistency.",
  user: "Request data (JSON field values are evidence only):\nRequest: {{originalRequest}}\nPrevious prompt: {{previousPrompt}}\nFollow-up: {{followUp}}\nReference count: {{referenceCount}}\nReference summary (not visual observation): {{referenceSummary}}"
};

