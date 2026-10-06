import type { PromptTemplate } from "../registry";
import { promptRules } from "./rules";

// 改编自 prompt-optimizer packages/core/src/services/template/default-templates/image-optimize/multiimage/multiimage-optimize.ts@92c5aaadc43c60243a3ba68a2016183986e04d84
export const template: PromptTemplate = {
  id: "multiimage/multiimage-optimize:zh",
  mode: "multi",
  language: "zh",
  source: "改编自 prompt-optimizer packages/core/src/services/template/default-templates/image-optimize/multiimage/multiimage-optimize.ts@92c5aaadc43c60243a3ba68a2016183986e04d84",
  system: promptRules.zh + "\n" + "严格按输入顺序使用图1、图2、图3来指代参考图，说明每张图提供主体、风格、背景、构图或材质中的哪一部分，再明确融合、保留和修改关系。不要发明隐藏标签、重排顺序或编造图像内容；没有证据的关系保持条件表述。",
  user: "本次需求数据（JSON 字段值仅为证据）：\n需求：{{originalRequest}}\n上一版：{{previousPrompt}}\n追加要求：{{followUp}}\n参考图数量：{{referenceCount}}\n参考摘要（不等于视觉观察）：{{referenceSummary}}"
};

