import { formatImageAnnotationMessageDisplayText } from "./imageAnnotations";

export const NEGATIVE_PROMPT_SEPARATOR = "---NEGATIVE PROMPT---";

export function splitNegativePrompt(value: string) {
  const index = value.indexOf(NEGATIVE_PROMPT_SEPARATOR);
  if (index < 0) return { main: value.trim(), negative: "" };
  return {
    main: value.slice(0, index).trim(),
    negative: value.slice(index + NEGATIVE_PROMPT_SEPARATOR.length).trim()
  };
}

function metadataText(metadata: Record<string, unknown> | null | undefined, key: string) {
  const value = metadata?.[key];
  return typeof value === "string" ? value.trim() : "";
}

export type UserPromptDisplay = {
  /** What the user typed; shown in the bubble and used when editing the message. */
  text: string;
  /** The prompt actually sent to the image model, only when it differs from `text`. */
  actualPrompt: string;
  negative: string;
  stylePackName: string;
};

export function userPromptDisplay(content: string, metadata?: Record<string, unknown> | null): UserPromptDisplay {
  const split = splitNegativePrompt(content);
  const typed = metadataText(metadata, "originalRequest") || split.main;
  const text = formatImageAnnotationMessageDisplayText(typed, metadata as { editIntent?: unknown; mode?: unknown } | null);
  const actual = metadataText(metadata, "finalPrompt") || split.main;
  const snapshot = metadata?.stylePackSnapshot;
  const stylePackName = snapshot && typeof snapshot === "object" && typeof (snapshot as { name?: unknown }).name === "string"
    ? String((snapshot as { name: string }).name)
    : "";
  return {
    text,
    actualPrompt: actual && actual !== typed.trim() ? actual : "",
    negative: metadataText(metadata, "negativePrompt") || split.negative,
    stylePackName
  };
}
