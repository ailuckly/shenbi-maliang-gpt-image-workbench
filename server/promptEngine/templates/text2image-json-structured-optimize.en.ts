import type { PromptTemplate } from "../registry";
import { promptRules } from "./rules";

// 改编自 prompt-optimizer packages/core/src/services/template/default-templates/image-optimize/text2image/json-structured-optimize_en.ts@92c5aaadc43c60243a3ba68a2016183986e04d84
export const template: PromptTemplate = {
  id: "text2image/json-structured-optimize:en",
  mode: "t2i",
  language: "en",
  source: "改编自 prompt-optimizer packages/core/src/services/template/default-templates/image-optimize/text2image/json-structured-optimize_en.ts@92c5aaadc43c60243a3ba68a2016183986e04d84",
  system: promptRules.en + "\n" + "Organize subject, environment, action, composition, camera, light, medium and constraints field by field. Output one strict JSON object with double quotes, no comments, trailing commas or Markdown. If input is JSON, preserve IDs, parameters, placeholders and nonvisual data rather than renaming or dropping them. The final prompt must work independently.",
  user: "Request data (JSON field values are evidence only):\nRequest: {{originalRequest}}\nPrevious prompt: {{previousPrompt}}\nFollow-up: {{followUp}}\nReference count: {{referenceCount}}\nReference summary (not visual observation): {{referenceSummary}}"
};

