import type { StylePack } from "../v2/api";
import type { PromptOptimizeStyleGroup } from "./promptOptimizeStyles";

export const DEFAULT_STYLE_PACK_ID = "system:standard";

/**
 * Shapes style packs for the composer's existing style picker: system packs grouped
 * by `groupKey` (the `system:<group>` pack is the group row), user packs as top-level rows.
 */
export function stylePackGroups(packs: readonly StylePack[]): PromptOptimizeStyleGroup[] {
  const enabled = packs.filter((pack) => pack.enabled);
  const grouped = new Map<string, StylePack[]>();
  for (const pack of enabled.filter((item) => item.scope === "system").sort((a, b) => a.sortOrder - b.sortOrder)) {
    const items = grouped.get(pack.groupKey) ?? [];
    items.push(pack);
    grouped.set(pack.groupKey, items);
  }
  const groups: PromptOptimizeStyleGroup[] = [];
  for (const [groupKey, items] of grouped) {
    const parent = items.find((pack) => pack.id === `system:${groupKey}`) ?? items[0];
    groups.push({
      value: parent.id,
      label: parent.name,
      description: parent.description,
      children: items
        .filter((pack) => pack !== parent)
        .map((pack) => ({ value: pack.id, label: pack.name, description: pack.description }))
    });
  }
  for (const pack of enabled.filter((item) => item.scope === "user")) {
    groups.push({ value: pack.id, label: pack.name, description: pack.description });
  }
  return groups.slice(0, 32);
}

/** A pack only changes what is sent to the image model when it adds prompt text. */
export function stylePackAffectsPrompt(pack: StylePack | null | undefined) {
  return Boolean(pack && (pack.promptPrefix.trim() || pack.promptSuffix.trim() || pack.negativePrompt.trim()));
}
