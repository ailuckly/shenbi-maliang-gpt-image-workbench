import { z } from "zod";

export const structuredPromptSchema = z.object({
  subject: z.string(), scene: z.string(), composition: z.string(), camera: z.string(),
  lighting: z.string(), style: z.string(), material: z.string(), text: z.string(),
  constraints: z.string(), negative: z.string(), finalPrompt: z.string()
});
export type StructuredPrompt = z.infer<typeof structuredPromptSchema>;
export const NEGATIVE_PROMPT_SEPARATOR = "---NEGATIVE PROMPT---";

function cleanPromptPart(value: string, stripHeadings: boolean) {
  let text = value.replace(/\r\n/g, "\n").trim();
  if (stripHeadings) {
    for (const pattern of [
      /^(?:正向提示词|AI提示词|优化提示词|提示词|Prompt|Positive prompt|Optimized prompt)\s*[:：]\s*/i,
      /^#+\s*(?:正向提示词|AI提示词|优化提示词|提示词|Prompt|Positive prompt|Optimized prompt)\s*\n+/i
    ]) text = text.replace(pattern, "").trim();
  }
  return text;
}

// Shared with the legacy optimizer: keep its separator and heading behavior.
export function splitPlainPrompt(content: string, options: { stripHeadings?: boolean } = {}) {
  const text = content.replace(/\r\n/g, "\n").trim();
  const stripHeadings = options.stripHeadings !== false;
  const separatorIndex = text.toUpperCase().indexOf(NEGATIVE_PROMPT_SEPARATOR);
  if (separatorIndex >= 0) return {
    prompt: cleanPromptPart(text.slice(0, separatorIndex), stripHeadings),
    negativePrompt: cleanPromptPart(text.slice(separatorIndex + NEGATIVE_PROMPT_SEPARATOR.length), stripHeadings)
  };
  const lines = text.split("\n");
  const labelIndex = lines.findIndex(line => /^(?:反向提示词|Negative prompt)\s*[:：]?\s*$/i.test(line.trim()));
  if (labelIndex >= 0) return {
    prompt: cleanPromptPart(lines.slice(0, labelIndex).join("\n"), stripHeadings),
    negativePrompt: cleanPromptPart(lines.slice(labelIndex + 1).join("\n"), stripHeadings)
  };
  const inlineIndex = lines.findIndex(line => /^(?:反向提示词|Negative prompt)\s*[:：]/i.test(line.trim()));
  if (inlineIndex >= 0) return {
    prompt: cleanPromptPart(lines.slice(0, inlineIndex).join("\n"), stripHeadings),
    negativePrompt: cleanPromptPart([
      lines[inlineIndex].replace(/^(?:反向提示词|Negative prompt)\s*[:：]\s*/i, ""),
      ...lines.slice(inlineIndex + 1)
    ].join("\n"), stripHeadings)
  };
  return { prompt: cleanPromptPart(text, stripHeadings), negativePrompt: "" };
}

export function parseStructuredPrompt(content: string): StructuredPrompt {
  const text = content.trim();
  const json = text.replace(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/i, "$1");
  try {
    const parsed = structuredPromptSchema.safeParse(JSON.parse(json));
    if (parsed.success) return parsed.data;
  } catch { /* Supplier prose and malformed JSON remain usable as plain prompts. */ }
  const plain = splitPlainPrompt(text);
  return {
    subject: "", scene: "", composition: "", camera: "", lighting: "", style: "",
    material: "", text: "", constraints: "", negative: plain.negativePrompt,
    finalPrompt: plain.prompt
  };
}
