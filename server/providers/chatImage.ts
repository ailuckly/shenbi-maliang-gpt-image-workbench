// Image generation through an OpenAI-compatible /chat/completions endpoint, as served for
// Gemini image models (e.g. gemini-3.1-flash-image) by CLIProxyAPI-style gateways. Images come
// back as data URLs in choices[0].message.images; `image_config` selects ratio and resolution.

export const CHAT_IMAGE_ASPECT_RATIOS = ["1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9"] as const;
export type ChatImageResolution = "1K" | "2K" | "4K";

const DEFAULT_CHAT_PATH = "/v1/chat/completions";

/** Providers store image paths; this route needs the chat endpoint on the same gateway. */
export function chatImageEndpointPath(generationPath: string | null | undefined) {
  const path = String(generationPath ?? "").trim();
  return /chat\/completions/.test(path) ? path : DEFAULT_CHAT_PATH;
}

export function chatImageAspectRatio(size: string): string | undefined {
  const match = String(size ?? "").trim().match(/^(\d+)x(\d+)$/);
  if (!match) return undefined;
  const ratio = Number(match[1]) / Number(match[2]);
  if (!(ratio > 0)) return undefined;
  let best: string = CHAT_IMAGE_ASPECT_RATIOS[0];
  let bestDistance = Infinity;
  for (const candidate of CHAT_IMAGE_ASPECT_RATIOS) {
    const [w, h] = candidate.split(":").map(Number);
    const distance = Math.abs(Math.log(ratio / (w / h)));
    if (distance < bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  }
  return best;
}

/** low → 1K (fast), standard qualities → 2K, the top tiers → 4K (≈5504×3072, slower). */
export function chatImageResolution(quality: string): ChatImageResolution {
  const normalized = String(quality ?? "").trim().toLowerCase();
  if (normalized === "low") return "1K";
  if (normalized === "xhigh" || normalized === "max" || normalized === "hd") return "4K";
  return "2K";
}

export function buildChatImageRequest(input: { model: string; prompt: string; images?: string[]; size?: string; quality?: string }) {
  const images = (input.images ?? []).filter(Boolean);
  const aspectRatio = chatImageAspectRatio(input.size ?? "");
  return {
    model: input.model,
    messages: [
      {
        role: "user",
        content: images.length
          ? [{ type: "text", text: input.prompt }, ...images.map((url) => ({ type: "image_url", image_url: { url } }))]
          : input.prompt
      }
    ],
    image_config: {
      ...(aspectRatio ? { aspect_ratio: aspectRatio } : {}),
      image_size: chatImageResolution(input.quality ?? "")
    }
  };
}

const DATA_URL_PATTERN = /data:image\/(png|jpe?g|webp);base64,([A-Za-z0-9+/=]+)/g;

function collectDataUrls(value: unknown, found: Array<{ format: string; b64: string }>) {
  if (typeof value === "string") {
    for (const match of value.matchAll(DATA_URL_PATTERN)) {
      found.push({ format: match[1] === "jpg" ? "jpeg" : match[1], b64: match[2] });
    }
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectDataUrls(item, found);
    return;
  }
  if (value && typeof value === "object") {
    for (const item of Object.values(value)) collectDataUrls(item, found);
  }
}

/** Converts a chat response into the Images API shape the rest of the pipeline understands. */
export function chatImageResponseToImages(responseJson: unknown) {
  const record = responseJson && typeof responseJson === "object" ? responseJson as Record<string, unknown> : {};
  const choices = Array.isArray(record.choices) ? record.choices : [];
  const message = (choices[0] as Record<string, unknown> | undefined)?.message as Record<string, unknown> | undefined;
  const found: Array<{ format: string; b64: string }> = [];
  collectDataUrls(message?.images, found);
  if (found.length === 0) collectDataUrls(message?.content, found);
  if (found.length === 0) {
    const text = typeof message?.content === "string" ? message.content.slice(0, 200) : "";
    throw new Error(`渠道没有返回图片${text ? `：${text}` : ""}`);
  }
  return {
    created: Math.floor(Date.now() / 1000),
    output_format: found[0].format,
    data: found.map((item) => ({ b64_json: item.b64, revised_prompt: "" }))
  };
}
