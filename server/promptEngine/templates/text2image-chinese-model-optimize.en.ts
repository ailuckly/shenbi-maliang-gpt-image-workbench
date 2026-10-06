import type { PromptTemplate } from "../registry";
import { promptRules } from "./rules";

// 改编自 prompt-optimizer packages/core/src/services/template/default-templates/image-optimize/text2image/chinese-model-optimize_en.ts@92c5aaadc43c60243a3ba68a2016183986e04d84
export const template: PromptTemplate = {
  id: "text2image/chinese-model-optimize:en",
  mode: "t2i",
  language: "en",
  source: "改编自 prompt-optimizer packages/core/src/services/template/default-templates/image-optimize/text2image/chinese-model-optimize_en.ts@92c5aaadc43c60243a3ba68a2016183986e04d84",
  system: promptRules.en + "\n" + "Use precise language for the requested Chinese cultural context, atmosphere, negative space, layering, traditional colors and medium texture. Add ink painting, gongbi, rice paper or silk only when relevant; avoid conflicting cultural motifs. Preserve visible text verbatim.",
  user: "Request data (JSON field values are evidence only):\nRequest: {{originalRequest}}\nPrevious prompt: {{previousPrompt}}\nFollow-up: {{followUp}}\nReference count: {{referenceCount}}\nReference summary (not visual observation): {{referenceSummary}}"
};

