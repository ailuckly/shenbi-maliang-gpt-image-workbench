import { describe, expect, test } from "bun:test";
import { IMAGE_CATEGORIES } from "./imageCategories";
import { classifyImageCategory, imageCategoryById, imageCategoryGuidance } from "./imageCategory";

describe("image categories", () => {
  test("every category carries a filled checklist and pitfalls", () => {
    expect(IMAGE_CATEGORIES).toHaveLength(13);
    for (const category of IMAGE_CATEGORIES) {
      expect(category.skeleton).toContain("[");
      expect(category.pitfalls.length).toBeGreaterThan(0);
    }
  });

  test("requests are classified by keyword hits", () => {
    expect(classifyImageCategory("做一个 AI 平台 Token 管理的后台仪表盘界面").id).toBe("ui");
    expect(classifyImageCategory("精品咖啡店开业海报，标题「山间咖啡」").id).toBe("poster");
    expect(classifyImageCategory("一款降噪耳机的电商主图").id).toBe("product");
    expect(classifyImageCategory("老年人健康管理信息图，流程图形式").id).toBe("infographic");
    expect(classifyImageCategory("唐朝宫廷仕女，工笔古风").id).toBe("history");
    expect(classifyImageCategory("一只橘猫").id).toBe("general");
  });

  test("lookup and guidance", () => {
    expect(imageCategoryById("brand")?.label).toBe("品牌与标志");
    expect(imageCategoryById("nope")).toBeNull();
    expect(imageCategoryGuidance(imageCategoryById("poster")!).pitfalls.length).toBeGreaterThan(2);
  });
});
