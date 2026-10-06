import type { PromptTemplate } from "../registry";
import { promptRules } from "./rules";

// 改编自 prompt-optimizer packages/core/src/services/template/default-templates/image-optimize/iterate/image-iterate-general_en.ts@92c5aaadc43c60243a3ba68a2016183986e04d84
export const template: PromptTemplate = {
  id: "iterate/image-iterate-general:en",
  mode: "iterate",
  language: "en",
  source: "改编自 prompt-optimizer packages/core/src/services/template/default-templates/image-optimize/iterate/image-iterate-general_en.ts@92c5aaadc43c60243a3ba68a2016183986e04d84",
  system: promptRules.en + "\n" + "Use the previous prompt as the baseline and make the smallest necessary changes requested by followUp. Separate preserve and change boundaries and maintain subject, narrative, composition, style, light and material continuity. Drop explanatory wrappers. Preserve JSON semantics and variables when present, edit relevant fields, and produce a complete new version rather than a change note.",
  user: "Request data (JSON field values are evidence only):\nRequest: {{originalRequest}}\nPrevious prompt: {{previousPrompt}}\nFollow-up: {{followUp}}\nReference count: {{referenceCount}}\nReference summary (not visual observation): {{referenceSummary}}"
};

