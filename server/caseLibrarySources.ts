export type ModelFamily = "gpt" | "gemini";
export type SourceCase = { id: string; title: string; image: string; prompt: string; category: string; tags: string[] };
const GPT_RAW = "https://raw.githubusercontent.com/freestylefly/awesome-gpt-image-2/main";
const NB_RAW = "https://raw.githubusercontent.com/xianyu110/awesome-nanobananapro-prompts/main/gpt4o-image-prompts-master";
export const EXCLUDED_NAMES = ["Disney", "迪士尼", "Zootopia", "Zootropolis", "疯狂动物城", "Marvel", "漫威", "Pokemon", "Pokémon", "宝可梦", "Trump", "特朗普", "Musk", "马斯克", "Steve Jobs", "乔布斯", "Taylor Swift", "泰勒·斯威夫特", "Harry Potter", "哈利波特", "Batman", "蝙蝠侠", "Spider-Man", "蜘蛛侠"];
const REFERENCE_DEPENDENCY = /reference\s+photo|参考照片|上传的照片|保留身份特征|same\s+face\s+as|uploaded\s+image|上传的参考|参考(?:图像|图片|面部)|attached\s+photo|input\s+image|输入图像/i;
export function isStandaloneCase(item: SourceCase) {
  const text = `${item.title} ${item.prompt}`.toLowerCase();
  return Boolean(item.prompt.trim() && item.image.trim()) && !REFERENCE_DEPENDENCY.test(text) && !EXCLUDED_NAMES.some((name) => text.includes(name.toLowerCase()));
}
export const CATEGORY_MAP: Record<string, string> = {
  product: "product", food: "product", toy: "product", typography: "poster", poster: "poster",
  branding: "brand", logo: "brand", interior: "architecture", architecture: "architecture",
  illustration: "illustration", "paper-craft": "illustration", creative: "illustration",
  landscape: "photo", nature: "photo", infographic: "infographic",
  "信息图 / 教育视觉图": "infographic", "电商主图": "product", "产品营销": "product",
  "海报 / 传单": "poster", "App / 网页设计": "ui", "漫画 / 故事板": "scene", "游戏素材": "character", "社交媒体帖子": "general",
  "UI & Interfaces": "ui", "Charts & Infographics": "infographic", "Posters & Typography": "poster",
  "Products & E-commerce": "product", "Brand & Logos": "brand", "Architecture & Spaces": "architecture",
  "Photography & Realism": "photo", "Illustration & Art": "illustration", "Characters & People": "character",
  "Scenes & Storytelling": "scene", "History & Classical Themes": "history", "Documents & Publishing": "document"
};
export function sourceImageCategory(item: SourceCase) {
  return CATEGORY_MAP[item.category] ?? item.tags.map((tag) => CATEGORY_MAP[tag]).find(Boolean) ?? "general";
}
export const NB_TAGS = new Set(["product", "typography", "branding", "logo", "interior", "illustration", "paper-craft", "food", "minimalist", "retro", "landscape", "nature", "toy", "creative", "architecture", "infographic", "poster"]);
export const YM_CATEGORIES = ["信息图 / 教育视觉图", "电商主图", "产品营销", "海报 / 传单", "App / 网页设计", "漫画 / 故事板", "游戏素材", "社交媒体帖子"];
export function selectNanobananaCases(items: SourceCase[]) {
  return items.filter((item) => isStandaloneCase(item) && item.tags.some((tag) => NB_TAGS.has(tag))).sort((a, b) => Number(b.id) - Number(a.id)).slice(0, 150);
}
export function selectYoumindCases(items: SourceCase[]) {
  return [...new Map(items.filter((item) => isStandaloneCase(item) && YM_CATEGORIES.includes(item.category)).map((item) => [item.id, item])).values()].slice(0, 80);
}
function records(data: unknown, key: string): Record<string, unknown>[] {
  const list = data && typeof data === "object" ? (data as Record<string, unknown>)[key] : null;
  return Array.isArray(list) ? list.filter((item) => item && typeof item === "object") : [];
}
const string = (value: unknown) => typeof value === "string" ? value : "";
export function parseNanobanana(data: unknown): SourceCase[] {
  return records(data, "items").filter((item) => Number.isSafeInteger(item.id) && Number(item.id) >= 0).map((item) => ({
    id: String(item.id), title: string(item.title), prompt: string(Array.isArray(item.prompts) ? item.prompts[0] : null),
    image: /^images\/[\w./-]+$/.test(string(Array.isArray(item.images) ? item.images[0] : null)) && !string(Array.isArray(item.images) ? item.images[0] : null).includes("..") ? `${NB_RAW}/${string(Array.isArray(item.images) ? item.images[0] : null)}` : "",
    category: "", tags: Array.isArray(item.tags) ? item.tags.filter((tag): tag is string => typeof tag === "string").map((tag) => tag.toLowerCase()) : []
  }));
}
export function parseGptCases(data: unknown): SourceCase[] {
  return records(data, "cases").filter((item) => Number.isSafeInteger(item.id) && Number(item.id) >= 0).map((item) => ({
    id: String(item.id), title: string(item.title), prompt: string(item.prompt), category: string(item.category), tags: [],
    image: string(item.image) ? `${GPT_RAW}/data/${string(item.image).replace(/^\//, "")}` : ""
  }));
}
const YM_INFERENCE: [string, RegExp][] = [
  [YM_CATEGORIES[0], /信息图|教育|科普|infographic/i], [YM_CATEGORIES[1], /电商|主图/i],
  [YM_CATEGORIES[2], /产品|营销|product/i], [YM_CATEGORIES[3], /海报|传单|poster/i],
  [YM_CATEGORIES[4], /app|网页|界面|网站/i], [YM_CATEGORIES[5], /漫画|故事板|分镜/i],
  [YM_CATEGORIES[6], /游戏素材|game\s+asset/i], [YM_CATEGORIES[7], /社交媒体|引言卡|social\s+media/i]
];
export function parseYoumind(markdown: unknown): SourceCase[] {
  if (typeof markdown !== "string") return [];
  const items: SourceCase[] = [];
  let section = "";
  for (const block of markdown.replace(/\r\n/g, "\n").split(/(?=^## |^### No\. )/m)) {
    if (block.startsWith("## ")) { section = block.split("\n")[0]; continue; }
    if (!/精选提示词|所有提示词/.test(section)) continue;
    const header = /^### No\. (\d+): (.+)\n/.exec(block);
    if (!header) continue;
    const split = section.includes("所有") ? header[2].indexOf(" - ") : -1;
    const title = split >= 0 ? header[2].slice(split + 3) : header[2];
    const category = split >= 0 ? header[2].slice(0, split) : YM_INFERENCE.find(([, keywords]) => keywords.test(title))?.[0] ?? "";
    const promptSection = block.split(/^#### 📝 提示词\s*$/m)[1]?.split(/^#### /m)[0] ?? "";
    const prompt = /```[^\n]*\n([\s\S]*?)\n```/.exec(promptSection)?.[1]?.replace(/\{argument\s+[^}]*?default="([^"]*)"[^}]*\}/g, "$1") ?? "";
    const imageSection = block.split(/^#### 🖼️ 生成图片\s*$/m)[1]?.split(/^#### /m)[0] ?? "";
    const image = /<img\b[^>]*\bsrc="(https:\/\/cms-assets\.youmind\.com\/[^"\s]+)"/i.exec(imageSection)?.[1] ?? "";
    const id = /nano-banana-pro-prompts\?id=(\d+)/.exec(block)?.[1] ?? `${section.includes("精选") ? "featured-" : ""}${header[1]}`;
    items.push({ id, title, prompt, image, category, tags: category ? [category] : [] });
  }
  return items;
}
export async function fetchCaseSource(url: string) {
  const response = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return response;
}
export const CASE_LIBRARY_SOURCES = [
  { id: "awesome-gpt-image-2", name: "awesome-gpt-image-2", license: "MIT", prefix: "library-", modelFamily: "gpt" as ModelFamily,
    fetch: async () => (await fetchCaseSource(`${GPT_RAW}/data/cases.json`)).json(), parse: parseGptCases,
    select: (items: SourceCase[]) => items.filter((item) => item.prompt && item.image) },
  { id: "nanobanana-cn", name: "Nano Banana 中文精选", license: "MIT", prefix: "library-nbcn-", modelFamily: "gemini" as ModelFamily,
    fetch: async () => (await fetchCaseSource(`${NB_RAW}/data/prompts.json`)).json(), parse: parseNanobanana, select: selectNanobananaCases },
  { id: "youmind", name: "YouMind Nano Banana Pro", license: "CC BY 4.0", prefix: "library-ym-", modelFamily: "gemini" as ModelFamily,
    fetch: async () => (await fetchCaseSource("https://raw.githubusercontent.com/YouMind-OpenLab/awesome-nano-banana-pro-prompts/main/README_zh.md")).text(), parse: parseYoumind, select: selectYoumindCases }
];
export function sourceCaseId(source: typeof CASE_LIBRARY_SOURCES[number], item: SourceCase) { return `${source.prefix}${item.id}`; }
