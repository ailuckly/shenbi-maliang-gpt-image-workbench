import { describe, expect, test } from "bun:test";
import { buildChatImageRequest, chatImageAspectRatio, chatImageEndpointPath, chatImageResolution, chatImageResponseToImages } from "./chatImage";

describe("chat image adapter", () => {
  test("maps sizes to the nearest supported ratio and qualities to resolutions", () => {
    expect(chatImageAspectRatio("2048x1152")).toBe("16:9");
    expect(chatImageAspectRatio("1536x2048")).toBe("3:4");
    expect(chatImageAspectRatio("2560x1024")).toBe("21:9");
    expect(chatImageAspectRatio("1024x2048")).toBe("9:16");
    expect(chatImageAspectRatio("auto")).toBeUndefined();
    expect(chatImageResolution("low")).toBe("1K");
    expect(chatImageResolution("high")).toBe("2K");
    expect(chatImageResolution("auto")).toBe("2K");
    expect(chatImageResolution("max")).toBe("4K");
    expect(chatImageEndpointPath("/v1/images/generations")).toBe("/v1/chat/completions");
    expect(chatImageEndpointPath("/chat/completions")).toBe("/chat/completions");
  });

  test("builds text-only and reference-image requests", () => {
    expect(buildChatImageRequest({ model: "gemini-3.1-flash-image", prompt: "猫", size: "2048x1152", quality: "high" })).toEqual({
      model: "gemini-3.1-flash-image",
      messages: [{ role: "user", content: "猫" }],
      image_config: { aspect_ratio: "16:9", image_size: "2K" }
    });
    const edit = buildChatImageRequest({ model: "m", prompt: "换背景", images: ["data:image/png;base64,AAA"], size: "auto" });
    expect(edit.messages[0].content).toEqual([
      { type: "text", text: "换背景" },
      { type: "image_url", image_url: { url: "data:image/png;base64,AAA" } }
    ]);
    expect(edit.image_config).toEqual({ image_size: "2K" });
  });

  test("parses images from the images field or content, and fails clearly without one", () => {
    const fromImages = chatImageResponseToImages({ choices: [{ message: { content: null, images: [{ type: "image_url", image_url: { url: "data:image/jpeg;base64,QUJD" } }] } }] });
    expect(fromImages.output_format).toBe("jpeg");
    expect(fromImages.data).toEqual([{ b64_json: "QUJD", revised_prompt: "" }]);
    const fromContent = chatImageResponseToImages({ choices: [{ message: { content: "好的 ![img](data:image/png;base64,WFla)" } }] });
    expect(fromContent.data[0].b64_json).toBe("WFla");
    expect(() => chatImageResponseToImages({ choices: [{ message: { content: "无法生成" } }] })).toThrow("渠道没有返回图片：无法生成");
  });
});
