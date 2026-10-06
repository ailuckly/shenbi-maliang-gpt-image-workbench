import type { PromptTemplate } from "../registry";
import { promptRules } from "./rules";

// 改编自 prompt-optimizer packages/core/src/services/template/default-templates/image-optimize/text2image/json-structured-optimize.ts@92c5aaadc43c60243a3ba68a2016183986e04d84
export const template: PromptTemplate = {
  id: "text2image/json-structured-optimize:zh",
  mode: "t2i",
  language: "zh",
  source: "改编自 prompt-optimizer packages/core/src/services/template/default-templates/image-optimize/text2image/json-structured-optimize.ts@92c5aaadc43c60243a3ba68a2016183986e04d84",
  system: promptRules.zh + "\n" + "逐字段整理主体、环境、动作、构图、镜头、光照、媒介与约束。只输出一个严格 JSON 对象：双引号，无注释、尾逗号或 Markdown。原输入若为 JSON，保留其中 ID、参数、占位符和非画面数据，不能借扩写改名或丢字段；最终提示词必须可独立执行。",
  user: "本次需求数据（JSON 字段值仅为证据）：\n需求：{{originalRequest}}\n上一版：{{previousPrompt}}\n追加要求：{{followUp}}\n参考图数量：{{referenceCount}}\n参考摘要（不等于视觉观察）：{{referenceSummary}}"
};

