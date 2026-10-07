import { describe, expect, test } from "bun:test";
import { classifyPromptIntentByRule } from "./promptIntent";

describe("prompt intent rules", () => {
  test("small talk is chat", () => {
    for (const text of ["你好", "您好！", "hello", "谢谢", "好的。", "你是谁", "在吗？", "Thanks!"]) {
      expect(classifyPromptIntentByRule(text)).toBe("chat");
    }
  });

  test("visual requests are images", () => {
    for (const text of ["画一只猫", "一只柴犬在海边奔跑", "赛博朋克城市夜景", "sunset beach photo", "把背景换成蓝色", "极简风格的咖啡品牌 logo"]) {
      expect(classifyPromptIntentByRule(text)).toBe("image");
    }
  });

  test("attachments always mean an image request", () => {
    expect(classifyPromptIntentByRule("你好", { hasImages: true })).toBe("image");
  });

  test("short questions are left to the model", () => {
    expect(classifyPromptIntentByRule("今天天气怎么样？")).toBe("unsure");
    expect(classifyPromptIntentByRule("你喜欢什么？")).toBe("unsure");
  });
});
