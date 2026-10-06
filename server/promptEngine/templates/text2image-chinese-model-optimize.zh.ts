import type { PromptTemplate } from "../registry";
import { promptRules } from "./rules";

// 改编自 prompt-optimizer packages/core/src/services/template/default-templates/image-optimize/text2image/chinese-model-optimize.ts@92c5aaadc43c60243a3ba68a2016183986e04d84
export const template: PromptTemplate = {
  id: "text2image/chinese-model-optimize:zh",
  mode: "t2i",
  language: "zh",
  source: "改编自 prompt-optimizer packages/core/src/services/template/default-templates/image-optimize/text2image/chinese-model-optimize.ts@92c5aaadc43c60243a3ba68a2016183986e04d84",
  system: promptRules.zh + "\n" + "围绕中文语境与用户选定的文化风格，用准确语言表达意境、留白、层次、传统配色和媒介肌理。水墨、工笔、宣纸、绢丝等仅在主题适合时补充，避免混用文化与堆砌符号；画面文字必须逐字保留。",
  user: "本次需求数据（JSON 字段值仅为证据）：\n需求：{{originalRequest}}\n上一版：{{previousPrompt}}\n追加要求：{{followUp}}\n参考图数量：{{referenceCount}}\n参考摘要（不等于视觉观察）：{{referenceSummary}}"
};

