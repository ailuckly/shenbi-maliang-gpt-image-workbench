import { expect, test } from "bun:test";
import { NEGATIVE_PROMPT_SEPARATOR, parseStructuredPrompt, splitPlainPrompt, structuredPromptSchema } from "./schema";

test("structured JSON, fenced JSON, malformed prose and legacy separators remain usable", () => {
  const structured = {
    subject: "蓝色瓶子", scene: "桌面", composition: "居中", camera: "正面", lighting: "自然光",
    style: "摄影", material: "玻璃", text: 'ShenBi "Light"', constraints: "只放一个",
    negative: "多余瓶子", finalPrompt: "桌面上一个蓝色玻璃瓶，居中，正面自然光，标签原文 ShenBi Light"
  };
  const json = JSON.stringify(structured);
  expect(parseStructuredPrompt(json)).toEqual(structured);
  expect(parseStructuredPrompt("```json\n" + json + "\n```")).toEqual(structured);
  expect(parseStructuredPrompt("{malformed JSON").finalPrompt).toBe("{malformed JSON");
  expect(parseStructuredPrompt("One bottle\n" + NEGATIVE_PROMPT_SEPARATOR + "\nextra bottles")).toMatchObject({ finalPrompt: "One bottle", negative: "extra bottles", subject: "" });
  expect(parseStructuredPrompt(JSON.stringify({ ...structured, text: ["wrong type"] })).finalPrompt).toContain('"text":["wrong type"]');
  expect(parseStructuredPrompt("literal {{subject}}" ).finalPrompt).toBe("literal {{subject}}");
  expect(structuredPromptSchema.safeParse(parseStructuredPrompt("")).success).toBe(true);
});

test("shared plain parser preserves legacy heading and negative-label behavior", () => {
  expect(splitPlainPrompt("Prompt: bottle\r\nNegative prompt:\r\nblur")).toEqual({ prompt: "bottle", negativePrompt: "blur" });
  expect(splitPlainPrompt("正向提示词：瓶子\n反向提示词：模糊")).toEqual({ prompt: "瓶子", negativePrompt: "模糊" });
  expect(splitPlainPrompt("Prompt: bottle", { stripHeadings: false }).prompt).toBe("Prompt: bottle");
  expect(splitPlainPrompt("bottle\n---negative prompt---\nblur").negativePrompt).toBe("blur");
});
