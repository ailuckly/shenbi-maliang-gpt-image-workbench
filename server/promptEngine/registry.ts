import { template as template0zh } from "./templates/text2image-general-image-optimize.zh";
import { template as template0en } from "./templates/text2image-general-image-optimize.en";
import { template as template1zh } from "./templates/text2image-photography-optimize.zh";
import { template as template1en } from "./templates/text2image-photography-optimize.en";
import { template as template2zh } from "./templates/text2image-creative-text2image.zh";
import { template as template2en } from "./templates/text2image-creative-text2image.en";
import { template as template3zh } from "./templates/text2image-chinese-model-optimize.zh";
import { template as template3en } from "./templates/text2image-chinese-model-optimize.en";
import { template as template4zh } from "./templates/text2image-json-structured-optimize.zh";
import { template as template4en } from "./templates/text2image-json-structured-optimize.en";
import { template as template5zh } from "./templates/image2image-image2image-optimize.zh";
import { template as template5en } from "./templates/image2image-image2image-optimize.en";
import { template as template6zh } from "./templates/image2image-design-text-edit-optimize.zh";
import { template as template6en } from "./templates/image2image-design-text-edit-optimize.en";
import { template as template7zh } from "./templates/image2image-json-structured-optimize.zh";
import { template as template7en } from "./templates/image2image-json-structured-optimize.en";
import { template as template8zh } from "./templates/multiimage-multiimage-optimize.zh";
import { template as template8en } from "./templates/multiimage-multiimage-optimize.en";
import { template as template9zh } from "./templates/iterate-image-iterate-general.zh";
import { template as template9en } from "./templates/iterate-image-iterate-general.en";

export type OptimizeMode = "t2i" | "i2i" | "multi" | "iterate";
export type PromptLanguage = "zh" | "en";
export type PromptTemplate = {
  id: string; mode: OptimizeMode; language: PromptLanguage;
  source: string; system: string; user: string;
};

export const promptTemplates: readonly PromptTemplate[] = [template0zh, template0en, template1zh, template1en, template2zh, template2en, template3zh, template3en, template4zh, template4en, template5zh, template5en, template6zh, template6en, template7zh, template7en, template8zh, template8en, template9zh, template9en];
const defaults: Record<OptimizeMode, string> = {
  t2i: "text2image/general-image-optimize", i2i: "image2image/image2image-optimize",
  multi: "multiimage/multiimage-optimize", iterate: "iterate/image-iterate-general"
};

export function listPromptTemplates(mode?: OptimizeMode, language?: PromptLanguage) {
  return promptTemplates.filter(template => (!mode || template.mode === mode) && (!language || template.language === language));
}

export function selectPromptTemplate(mode: OptimizeMode = "t2i", language: PromptLanguage = "zh", templateId?: string) {
  const id = templateId || defaults[mode] + ":" + language;
  const template = promptTemplates.find(template => template.id === id && template.mode === mode && template.language === language);
  if (!template) throw new Error("未知或不适合当前模式/语言的提示词模板");
  return template;
}

export type TemplateInput = {
  originalRequest: string; previousPrompt?: string; followUp?: string;
  referenceCount?: number; referenceSummary?: string;
};

export function renderPromptTemplate(template: PromptTemplate, input: TemplateInput) {
  const values = { originalRequest: input.originalRequest, previousPrompt: input.previousPrompt ?? "",
    followUp: input.followUp ?? "", referenceCount: input.referenceCount ?? 0, referenceSummary: input.referenceSummary ?? "" };
  const render = (text: string) => text.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
    if (!(key in values)) throw new Error("模板包含未知变量：" + key);
    return JSON.stringify(values[key as keyof typeof values]);
  });
  return { system: render(template.system), user: render(template.user) };
}

