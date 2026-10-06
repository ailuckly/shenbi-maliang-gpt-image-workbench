import { expect, test } from "bun:test";
import { composePrompt } from "./compose";

test("composition deduplicates segments and negatives, and resolves explicit parameter precedence", () => {
  expect(composePrompt({ prompt: "  one   bottle ", negativePrompt: "blur, extra bottles\nBLUR", stylePack: {
    promptPrefix: "", promptSuffix: "one bottle", negativePrompt: "extra bottles，watermark",
    recommendedParams: { n: 2, quality: "high", aspectRatio: "4:3" }
  }, userParams: { n: 3, quality: undefined }, providerDefaults: { n: 1, quality: "auto", aspectRatio: "1:1" } })).toEqual({
    finalPrompt: "one bottle", negative: "blur, extra bottles, watermark",
    params: { n: 3, quality: "high", aspectRatio: "4:3" }
  });
  expect(composePrompt({prompt:"瓶子",stylePack:{promptPrefix:"产品摄影",promptSuffix:"柔光"}}).finalPrompt).toBe("产品摄影\n瓶子\n柔光");
});

test("manual final prompt and negative remain authoritative without hidden reapplication", () => {
  expect(composePrompt({prompt:'Exact  title\nShenBi',negativePrompt:"My exact negative",manuallyEdited:true,
    stylePack:{promptPrefix:"Add this",promptSuffix:"Another phrase",negativePrompt:"Hidden negative"}})).toEqual({
    finalPrompt:'Exact  title\nShenBi',negative:"My exact negative",params:{}
  });
});
