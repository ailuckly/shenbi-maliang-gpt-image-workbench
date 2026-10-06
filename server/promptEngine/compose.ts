export type PromptParams = { aspectRatio?: string; quality?: string; n?: number };
export type ComposableStylePack = {
  promptPrefix?: string; promptSuffix?: string; negativePrompt?: string; recommendedParams?: PromptParams;
};

function uniqueParts(parts: string[]) {
  const seen = new Set<string>();
  return parts.map(part => part.replace(/[\t ]+/g, " ").trim()).filter(part => {
    const key = part.toLowerCase();
    if (!part || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function composePrompt(input: {
  prompt: string; negativePrompt?: string; stylePack?: ComposableStylePack | null;
  manuallyEdited?: boolean; userParams?: PromptParams; providerDefaults?: PromptParams;
}) {
  const pack = input.stylePack;
  const finalPrompt = input.manuallyEdited ? input.prompt : uniqueParts([
    pack?.promptPrefix || "", input.prompt, pack?.promptSuffix || ""
  ]).join("\n");
  const negative = input.manuallyEdited ? input.negativePrompt || "" : uniqueParts([
    input.negativePrompt || "", pack?.negativePrompt || ""
  ].flatMap(part => part.split(/[,，;；\n]+/))).join(", ");
  const explicitParams = Object.fromEntries(Object.entries(input.userParams || {}).filter(([, value]) => value !== undefined));
  return {
    finalPrompt, negative,
    params: { ...input.providerDefaults, ...pack?.recommendedParams, ...explicitParams } as PromptParams
  };
}
