// When the user leaves size on "auto", pick the configured size whose ratio the request asks
// for ("横向宽幅", "PPT", "竖版海报", "16:9" …). Without a clear signal the model decides.

type SizeEntry = { value: string; ratio: number };

const KNOWN_RATIOS = new Set(["1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "1:2", "2:1", "21:9", "9:21", "5:2", "2:5", "3:1", "1:3"]);

// Checked in order; the first matching rule wins. Horizontal words come before portrait
// defaults so "横版海报" stays landscape while "海报" alone is portrait.
const KEYWORD_RULES: Array<{ pattern: RegExp; ratio: number }> = [
  { pattern: /电影宽银幕|宽银幕|带鱼屏|\b(?:cinemascope|anamorphic)\b/i, ratio: 21 / 9 },
  { pattern: /横向宽幅|超宽|宽幅|长卷|横卷|手卷|全景|\b(?:panorama|panoramic|ultra[\s-]?wide)\b/i, ratio: 2.5 },
  { pattern: /竖向长卷|竖幅长图|条幅|长图/i, ratio: 1 / 2 },
  { pattern: /横版|横向|横屏|宽屏|横幅|ppt|幻灯片|演示文稿|网页头图|视频封面|桌面壁纸|\b(?:banner|landscape)\b/i, ratio: 16 / 9 },
  { pattern: /竖屏|手机壁纸|抖音|快手|故事封面|\b(?:story|stories)\b/i, ratio: 9 / 16 },
  { pattern: /小红书|竖版|竖图|\bportrait\b/i, ratio: 3 / 4 },
  { pattern: /海报|书封|\bposter\b/i, ratio: 2 / 3 },
  { pattern: /正方形|方形|方图|头像|logo|图标|\b(?:icon|square)\b/i, ratio: 1 }
];

function sizeEntries(sizes: readonly string[]): SizeEntry[] {
  return sizes.flatMap((value) => {
    const match = value.trim().match(/^(\d+)x(\d+)$/);
    if (!match) return [];
    const width = Number(match[1]);
    const height = Number(match[2]);
    return width > 0 && height > 0 ? [{ value: value.trim(), ratio: width / height }] : [];
  });
}

function closestSize(entries: SizeEntry[], ratio: number) {
  let best: SizeEntry | null = null;
  for (const entry of entries) {
    if (!best || Math.abs(Math.log(entry.ratio / ratio)) < Math.abs(Math.log(best.ratio / ratio))) best = entry;
  }
  return best?.value ?? null;
}

export function requestedAspectRatio(prompt: string): number | null {
  const text = prompt.replace(/\s+/g, " ");
  for (const match of text.matchAll(/(\d{1,2})\s*[:：比]\s*(\d{1,2})/g)) {
    const key = `${Number(match[1])}:${Number(match[2])}`;
    if (KNOWN_RATIOS.has(key)) return Number(match[1]) / Number(match[2]);
  }
  for (const rule of KEYWORD_RULES) {
    if (rule.pattern.test(text)) return rule.ratio;
  }
  return null;
}

export function inferAspectSize(prompt: string, sizes: readonly string[]): string | null {
  const ratio = requestedAspectRatio(prompt);
  if (ratio === null) return null;
  return closestSize(sizeEntries(sizes), ratio);
}
