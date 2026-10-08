import { describe, expect, test } from "bun:test";
import { DEFAULT_IMAGE_SIZES, PREVIOUS_DEFAULT_IMAGE_SIZES } from "./constants";
import { inferAspectSize } from "./imageAspect";

describe("aspect inference for auto size", () => {
  const sizes = DEFAULT_IMAGE_SIZES;

  test("explicit ratios win", () => {
    expect(inferAspectSize("做一张 16:9 的海报", sizes)).toBe("2048x1152");
    expect(inferAspectSize("比例 21：9，电影感", sizes)).toBe("2688x1152");
    expect(inferAspectSize("开业时间 10:30，竖版海报", sizes)).toBe("1536x2048");
  });

  test("keywords map to the closest configured ratio", () => {
    expect(inferAspectSize("生成一张横向宽幅的视觉俳句留白小品", sizes)).toBe("2560x1024");
    expect(inferAspectSize("剧本杀商业融资 PPT 封面", sizes)).toBe("2048x1152");
    expect(inferAspectSize("横版海报，夏日音乐节", sizes)).toBe("2048x1152");
    expect(inferAspectSize("精品咖啡店开业海报", sizes)).toBe("1344x2016");
    expect(inferAspectSize("一个品牌 logo", sizes)).toBe("1024x1024");
    expect(inferAspectSize("手机壁纸，星空", sizes)).toBe("1152x2048");
  });

  test("no signal keeps auto, and older size lists still get the nearest ratio", () => {
    expect(inferAspectSize("一只橘猫在窗台上晒太阳", sizes)).toBeNull();
    expect(inferAspectSize("横向宽幅山水", PREVIOUS_DEFAULT_IMAGE_SIZES)).toBe("2048x1152");
  });

  test("English keywords only match whole words", () => {
    expect(inferAspectSize("a natural history museum hall", sizes)).toBeNull();
    expect(inferAspectSize("an iconic silicon chip macro shot", sizes)).toBeNull();
    expect(inferAspectSize("instagram story about coffee", sizes)).toBe("1152x2048");
    expect(inferAspectSize("app icon of a fox", sizes)).toBe("1024x1024");
  });
});
