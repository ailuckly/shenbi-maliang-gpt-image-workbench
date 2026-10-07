import { IMAGE_CATEGORIES, type ImageCategory } from "./imageCategories";

const FALLBACK = IMAGE_CATEGORIES.find((category) => category.keywords === null)!;

export function imageCategoryById(id: unknown): ImageCategory | null {
  return IMAGE_CATEGORIES.find((category) => category.id === id) ?? null;
}

/** Picks the category with the most keyword hits; ties keep the list order. */
export function classifyImageCategory(text: string): ImageCategory {
  let best: ImageCategory = FALLBACK;
  let bestScore = 0;
  for (const category of IMAGE_CATEGORIES) {
    if (!category.keywords) continue;
    const pattern = new RegExp(category.keywords.source, "gi");
    const score = text.match(pattern)?.length ?? 0;
    if (score > bestScore) {
      best = category;
      bestScore = score;
    }
  }
  return best;
}

/** Category context sent to the optimizer alongside the template. */
export function imageCategoryGuidance(category: ImageCategory) {
  return {
    name: category.label,
    structureChecklist: category.skeleton,
    pitfalls: category.pitfalls,
    howToUse: "Treat structureChecklist as a checklist, not text to copy: make sure every bracketed slot is decided, "
      + "taking values from the request first and choosing tasteful, specific values otherwise. Apply the pitfalls. "
      + "Never let the checklist override what the user explicitly asked for."
  };
}
