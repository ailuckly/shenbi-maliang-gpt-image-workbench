export const DEFAULT_SOURCE_CODE_URL = "https://github.com/ailuckly/shenbi-maliang-gpt-image-workbench";

export function normalizeSourceCodeUrl(value: unknown): string {
  const input = String(value ?? "").trim();
  if (!input) return DEFAULT_SOURCE_CODE_URL;
  const url = new URL(input);
  if (input.length > 2048 || !["https:", "http:"].includes(url.protocol) || url.username || url.password) {
    throw new Error("源代码地址须为不含凭证的 HTTP(S) 链接");
  }
  return url.href;
}
