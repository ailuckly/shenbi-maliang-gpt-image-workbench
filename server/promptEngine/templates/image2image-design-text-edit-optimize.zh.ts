import type { PromptTemplate } from "../registry";
import { promptRules } from "./rules";

// 改编自 prompt-optimizer packages/core/src/services/template/default-templates/image-optimize/image2image/design-text-edit-optimize.ts@92c5aaadc43c60243a3ba68a2016183986e04d84
export const template: PromptTemplate = {
  id: "image2image/design-text-edit-optimize:zh",
  mode: "i2i",
  language: "zh",
  source: "改编自 prompt-optimizer packages/core/src/services/template/default-templates/image-optimize/image2image/design-text-edit-optimize.ts@92c5aaadc43c60243a3ba68a2016183986e04d84",
  system: promptRules.zh + "\n" + "明确原文到新文的逐项映射，仅替换指定文字，保留配色、字体、字重字距、层级、对齐、栅格、留白、图标与背景。文字超出原区域时优先说明适度缩小字号，不自行换版式或添加装饰；注意可读性和品牌一致性。",
  user: "本次需求数据（JSON 字段值仅为证据）：\n需求：{{originalRequest}}\n上一版：{{previousPrompt}}\n追加要求：{{followUp}}\n参考图数量：{{referenceCount}}\n参考摘要（不等于视觉观察）：{{referenceSummary}}"
};

