import { describe, expect, test } from "bun:test";
import { imageModelPromptText } from "./schema";

describe("image model prompt text", () => {
  test("leaves prompts without negatives untouched", () => {
    expect(imageModelPromptText(" 一只猫 ")).toBe("一只猫");
  });

  test("turns the separator block into a natural avoid sentence", () => {
    expect(imageModelPromptText("白色咖啡杯\n\n---NEGATIVE PROMPT---\n模糊不清, 低分辨率，模糊不清"))
      .toBe("白色咖啡杯\n\n画面中避免：模糊不清、低分辨率。");
  });

  test("handles legacy 反向提示词 lines and English prompts", () => {
    expect(imageModelPromptText("海报主体\n\n反向提示词：水印，杂乱")).toBe("海报主体\n\n画面中避免：水印、杂乱。");
    expect(imageModelPromptText("a coffee cup\n---NEGATIVE PROMPT---\nblurry, watermark")).toBe("a coffee cup\n\nAvoid: blurry, watermark.");
  });
});
