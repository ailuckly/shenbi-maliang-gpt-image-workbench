import { describe, expect, test } from "bun:test";
import {
  DEFAULT_EDIT_IMAGE_MODEL,
  DEFAULT_GENERATION_IMAGE_MODEL,
  DEFAULT_IMAGE_QUALITY,
  fallbackImageQuality,
  imageModelDisplayName,
  imageModelQualities,
  isImageModelId,
  latestConversationImageSelection,
  normalizeImageModel,
  normalizeImageQuality
} from "./imageModels";

describe("image model selection", () => {
  test("preserves configured model IDs through history, draft and editor normalization", () => {
    expect(normalizeImageModel(" vendor/custom-image-v3 ", DEFAULT_EDIT_IMAGE_MODEL)).toBe("vendor/custom-image-v3");
    expect(latestConversationImageSelection([{role:"user",metadata:{model:"vendor/custom-image-v3",quality:"max"}}])).toEqual({imageModel:"vendor/custom-image-v3",quality:"auto"});
    expect(normalizeImageModel("bad\nmodel", DEFAULT_EDIT_IMAGE_MODEL)).toBe(DEFAULT_EDIT_IMAGE_MODEL);
    expect(normalizeImageModel("x".repeat(257), DEFAULT_EDIT_IMAGE_MODEL)).toBe(DEFAULT_EDIT_IMAGE_MODEL);
  });
  test("keeps the three supported public model ids explicit", () => {
    expect(isImageModelId("gpt-image-2.5-flare")).toBe(true);
    expect(isImageModelId("gpt-image-2.5-sunburst")).toBe(true);
    expect(isImageModelId("gpt-image-2")).toBe(true);
    expect(isImageModelId("gpt-image-2.5")).toBe(false);
  });

  test("uses Sunburst as the quality-first default for creation and editing", () => {
    expect(normalizeImageModel(undefined, DEFAULT_GENERATION_IMAGE_MODEL)).toBe("gpt-image-2.5-sunburst");
    expect(normalizeImageModel(undefined, DEFAULT_EDIT_IMAGE_MODEL)).toBe("gpt-image-2.5-sunburst");
    expect(DEFAULT_IMAGE_QUALITY).toBe("auto");
    expect(normalizeImageQuality("gpt-image-2.5-flare", undefined)).toBe("auto");
  });

  test("restores the latest image selection from conversation requests", () => {
    expect(latestConversationImageSelection([
      { role: "user", metadata: { model: "gpt-image-2.5-flare", quality: "low" } },
      { role: "assistant", metadata: { actualModel: "gpt-image-2.5-flare", actualQuality: "low" } },
      { role: "user", metadata: { model: "gpt-image-2.5-sunburst", quality: "max" } }
    ])).toEqual({ imageModel: "gpt-image-2.5-sunburst", quality: "max" });
    expect(latestConversationImageSelection([{ role: "assistant", metadata: { actualModel: "gpt-image-2" } }])).toBeNull();
  });

  test("uses consistent product-style display names", () => {
    expect(imageModelDisplayName("gpt-image-2.5-flare")).toBe("GPT Image 2.5 Flare");
    expect(imageModelDisplayName("gpt-image-2.5-sunburst")).toBe("GPT Image 2.5 Sunburst");
    expect(imageModelDisplayName("gpt-image-2")).toBe("GPT Image 2");
  });

  test("only exposes xhigh and max on GPT Image 2.5", () => {
    expect(imageModelQualities("gpt-image-2.5-flare")).toEqual(["low", "medium", "high", "xhigh", "max"]);
    expect(imageModelQualities("gpt-image-2")).toEqual(["low", "medium", "high"]);
    expect(fallbackImageQuality("max")).toBe("high");
    expect(fallbackImageQuality("medium")).toBe("medium");
    expect(fallbackImageQuality("auto")).toBe("auto");
    expect(normalizeImageQuality("gpt-image-2.5-flare", "auto")).toBe("auto");
    expect(normalizeImageQuality("gpt-image-2.5-sunburst", "max")).toBe("max");
    expect(normalizeImageQuality("gpt-image-2", "max")).toBe("auto");
  });
});
