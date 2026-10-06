import type { PromptTemplate } from "../registry";
import { promptRules } from "./rules";

// 改编自 prompt-optimizer packages/core/src/services/template/default-templates/image-optimize/iterate/image-iterate-general.ts@92c5aaadc43c60243a3ba68a2016183986e04d84
export const template: PromptTemplate = {
  id: "iterate/image-iterate-general:zh",
  mode: "iterate",
  language: "zh",
  source: "改编自 prompt-optimizer packages/core/src/services/template/default-templates/image-optimize/iterate/image-iterate-general.ts@92c5aaadc43c60243a3ba68a2016183986e04d84",
  system: promptRules.zh + "\n" + "以上一版提示词为依据，按 followUp 做最小必要修改，明确保留与改变，维持主体、叙事、构图、风格、光照和材质连续性。不得机械携带解释性包装。若上一版含 JSON 结构或变量，保留结构语义和变量，只调整与追加要求有关的字段，生成完整的新版本而非修改说明。",
  user: "本次需求数据（JSON 字段值仅为证据）：\n需求：{{originalRequest}}\n上一版：{{previousPrompt}}\n追加要求：{{followUp}}\n参考图数量：{{referenceCount}}\n参考摘要（不等于视觉观察）：{{referenceSummary}}"
};

