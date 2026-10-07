import { expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { CASE_LIBRARY_SOURCES, CATEGORY_MAP, EXCLUDED_NAMES, isStandaloneCase, parseGptCases, parseNanobanana, parseYoumind, selectNanobananaCases, selectYoumindCases, sourceCaseId, sourceImageCategory, type SourceCase } from "./caseLibrarySources";
const item: SourceCase = { id: "1", title: "商品", prompt: "干净的商品棚拍", image: "https://example.test/a.png", tags: ["product"], category: "" };
test("nanobanana fixture uses first prompt/image, removes reference/IP and unsupported tags", async () => {
  const data = JSON.parse(await readFile(new URL("./fixtures/caseLibrary/nanobanana-cn.sample.json", import.meta.url), "utf8"));
  const parsed = parseNanobanana(data);
  expect(parsed).toHaveLength(5);
  expect(parsed[0].image).toEndWith("/images/627.jpeg");
  expect(parsed[0].prompt).toBe(data.items[0].prompts[0]);
  expect(selectNanobananaCases(parsed).map((row) => row.id)).toEqual(["627", "624"]);
  expect(selectNanobananaCases([{ ...item, tags: ["portrait", "fashion", "character"] }])).toEqual([]);
  expect(selectNanobananaCases([{ ...item, tags: ["portrait", "product"] }])).toHaveLength(1);
  expect(parseNanobanana({ items: [{ id: 1, images: ["images/../private"] }, { id: "oops" }] })[0].image).toBe("");
});
test("youmind parses both sections, substitutes defaults and avoids colliding No. IDs", async () => {
  const markdown = await readFile(new URL("./fixtures/caseLibrary/youmind-README_zh.sample.md", import.meta.url), "utf8");
  const parsed = parseYoumind(markdown);
  expect(parsed).toHaveLength(6);
  expect(parsed[0].id).toBe("151");
  expect(parsed[2].id).toBe("35920");
  expect(parsed[0].prompt).toContain("Steve Jobs");
  expect(parsed[0].prompt).not.toContain("{argument");
  expect(parsed[0].image).toEndWith("1763886933714_5zqn1e_G6QBjQHbgAE3Yt_.jpg");
  expect(selectYoumindCases(parsed).map((row) => row.id)).toEqual(["6847", "35743"]);
  expect(parseYoumind(markdown.replaceAll("\n", "\r\n"))).toEqual(parsed);
  expect(selectYoumindCases([...parsed, ...parsed])).toHaveLength(2);
  expect(parseYoumind('## 🔥 精选提示词\n### No. 1: 无分类标题\n#### 📝 提示词\n```\nx\n```\n')).toHaveLength(1);
  expect(selectYoumindCases(parseYoumind('## 🔥 精选提示词\n### No. 1: 无分类标题\n'))).toEqual([]);
});
test("curation is bounded, excludes empty content and maintained name/reference lists", () => {
  for (const name of EXCLUDED_NAMES) expect(isStandaloneCase({ ...item, title: name })).toBe(false);
  for (const text of ["reference photo", "参考照片", "上传的照片", "保留身份特征", "same face as", "uploaded image"]) expect(isStandaloneCase({ ...item, prompt: text })).toBe(false);
  expect(isStandaloneCase({ ...item, prompt: " " })).toBe(false);
  expect(isStandaloneCase({ ...item, image: "" })).toBe(false);
  const rows = Array.from({ length: 200 }, (_, i) => ({ ...item, id: String(i), category: "电商主图" }));
  expect(selectNanobananaCases(rows)).toHaveLength(150);
  expect(selectNanobananaCases(rows)[0].id).toBe("199");
  expect(selectYoumindCases(rows)).toHaveLength(80);
});
test("all mapped tags/categories and source ID prefixes preserve the legacy contract", () => {
  for (const [category, imageCategory] of Object.entries(CATEGORY_MAP)) {
    expect(sourceImageCategory({ ...item, category })).toBe(imageCategory);
    expect(sourceImageCategory({ ...item, category: "", tags: [category] })).toBe(imageCategory);
  }
  expect(sourceImageCategory({ ...item, tags: ["retro"] })).toBe("general");
  expect(CASE_LIBRARY_SOURCES.map((source) => sourceCaseId(source, item))).toEqual(["library-1", "library-nbcn-1", "library-ym-1"]);
  expect(parseGptCases({ cases: [{ id: 42, title: "x", prompt: "y", image: "/images/x.png", category: "Other Use Cases" }] })[0].image).toEndWith("/data/images/x.png");
});
