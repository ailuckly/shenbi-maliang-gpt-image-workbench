import { describe, expect, test } from "bun:test";
import { splitNegativePrompt, userPromptDisplay } from "./promptDisplay";

describe("user prompt display", () => {
  test("plain messages show as typed without details", () => {
    expect(userPromptDisplay("一只小狗", {})).toEqual({ text: "一只小狗", actualPrompt: "", negative: "", stylePackName: "" });
  });

  test("legacy negative separator moves out of the bubble text", () => {
    const display = userPromptDisplay("白色咖啡杯\n\n---NEGATIVE PROMPT---\n模糊，水印", {});
    expect(display.text).toBe("白色咖啡杯");
    expect(display.negative).toBe("模糊，水印");
    expect(display.actualPrompt).toBe("");
  });

  test("style pack messages show the typed request and expose the composed prompt", () => {
    const display = userPromptDisplay("professional product photography\n白色咖啡杯\n\n---NEGATIVE PROMPT---\nblurry", {
      originalRequest: "白色咖啡杯",
      finalPrompt: "professional product photography\n白色咖啡杯",
      negativePrompt: "blurry",
      stylePackSnapshot: { name: "商业产品" }
    });
    expect(display).toEqual({
      text: "白色咖啡杯",
      actualPrompt: "professional product photography\n白色咖啡杯",
      negative: "blurry",
      stylePackName: "商业产品"
    });
  });

  test("split keeps text without separator intact", () => {
    expect(splitNegativePrompt(" a cat ")).toEqual({ main: "a cat", negative: "" });
  });
});
