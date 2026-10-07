import { appDb, configDb, getAll, getOne, run } from "./db";
import { CASE_LIBRARY_ID_PREFIX } from "./caseLibrary";
import { globalSwitchEnabled } from "./globalSwitches";
import type { PromptOptimizerProviderRow } from "./promptOptimizerRoutes";
import type { ProviderRow } from "./types";
import { now } from "./utils";

// Configuration health for the admin "快速设置" page: what is active, and concrete problems
// with an optional one-click fix. Rules only read config; fixes are explicit admin actions.

export type SetupIssue = {
  id: string;
  level: "error" | "warning" | "info";
  title: string;
  detail: string;
  tab: string;
  fix?: "remove_invalid_assignments" | "reset_temperature";
};

const HIGH_TEMPERATURE = 1.2;
const RECOMMENDED_TEMPERATURE = 0.7;
const IMAGE_MODEL_PATTERN = /(^|[-_/])(gpt-image|dall-e|imagen|image-?\d|flux|sdxl|stable-diffusion|seedream|midjourney|grok-imagine)/i;

type AssignmentRow = { usage_key: string; provider_id: string; model: string };

function invalidAssignments(textProviders: PromptOptimizerProviderRow[]) {
  const enabled = new Map(textProviders.filter((row) => row.enabled).map((row) => [row.id, row]));
  return getAll<AssignmentRow>(configDb, "select usage_key, provider_id, model from language_model_assignments").filter((row) => {
    if (!row.provider_id) return false;
    if (!enabled.has(row.provider_id)) return true;
    return IMAGE_MODEL_PATTERN.test(String(row.model ?? ""));
  });
}

export function setupStatus() {
  const imageProviders = getAll<ProviderRow>(configDb, "select * from provider_configs order by rowid asc");
  const textProviders = getAll<PromptOptimizerProviderRow>(configDb, "select * from prompt_optimizer_providers order by sort_order asc, created_at asc");
  const activeImage = imageProviders.find((row) => row.enabled) ?? null;
  const activeText = textProviders.find((row) => row.enabled) ?? null;
  const caseCount = getOne<{ count: number }>(appDb, "select count(*) as count from case_items where id like ?", `${CASE_LIBRARY_ID_PREFIX}%`)?.count ?? 0;
  const issues: SetupIssue[] = [];

  if (!activeImage) {
    issues.push({ id: "no-image-provider", level: "error", title: "没有启用的图像渠道", detail: "用户无法生图。请在「图像渠道」新增或启用一个渠道并测试连接。", tab: "providers" });
  } else if (activeImage.route_mode !== "images_api" && !String(activeImage.responses_model ?? "").trim()) {
    issues.push({ id: "no-responses-model", level: "warning", title: "未填写改写模型", detail: `渠道「${activeImage.name}」会走 Responses 接口，但没有填写改写模型（Responses 模型 ID）。`, tab: "providers" });
  }
  if (!activeText) {
    issues.push({ id: "no-text-provider", level: "error", title: "没有启用的文本模型", detail: "提示词优化、自动检查、标题生成等都会失效。请在「文本模型」启用一个模型。", tab: "promptOptimizer" });
  }
  const broken = invalidAssignments(textProviders);
  if (broken.length) {
    issues.push({
      id: "invalid-assignments",
      level: "error",
      title: `${broken.length} 条用途分配无效`,
      detail: `${broken.map((row) => row.usage_key).join("、")} 指向已停用的渠道或图像模型，调用会失败。修复后这些用途改为跟随全局默认。`,
      tab: "promptOptimizer",
      fix: "remove_invalid_assignments"
    });
  }
  const hot = textProviders.filter((row) => row.enabled && row.temperature !== null && Number(row.temperature) > HIGH_TEMPERATURE);
  if (hot.length) {
    issues.push({
      id: "high-temperature",
      level: "warning",
      title: "文本模型温度过高",
      detail: `${hot.map((row) => `「${row.name}」${row.temperature}`).join("、")}。温度越高输出越随机，提示词优化和检查会不稳定，建议 ${RECOMMENDED_TEMPERATURE}。`,
      tab: "promptOptimizer",
      fix: "reset_temperature"
    });
  }
  if (caseCount === 0) {
    issues.push({ id: "empty-case-library", level: "info", title: "案例库尚未同步", detail: "同步后，提示词优化会参考同图类的优秀案例，灵感空间也会有内容。", tab: "caseLibrary" });
  }
  const disabledImage = imageProviders.filter((row) => !row.enabled).length;
  if (disabledImage > 0) {
    issues.push({ id: "disabled-providers", level: "info", title: `${disabledImage} 个图像渠道已停用`, detail: "不影响使用；不再需要可以在「图像渠道」删除，保持列表整洁。", tab: "providers" });
  }

  return {
    image: activeImage ? {
      id: activeImage.id,
      name: activeImage.name,
      model: activeImage.model,
      routeMode: activeImage.route_mode,
      responsesModel: activeImage.responses_model,
      defaultQuality: activeImage.default_quality
    } : null,
    text: activeText ? {
      id: activeText.id,
      name: activeText.name,
      model: activeText.model,
      temperature: activeText.temperature,
      status: activeText.availability_status
    } : null,
    caseLibrary: { count: caseCount },
    qualityCheck: { enabled: globalSwitchEnabled("image_quality_check") },
    issues
  };
}

export function applySetupFix(action: string) {
  const textProviders = getAll<PromptOptimizerProviderRow>(configDb, "select * from prompt_optimizer_providers");
  if (action === "remove_invalid_assignments") {
    const rows = invalidAssignments(textProviders);
    for (const row of rows) run(configDb, "delete from language_model_assignments where usage_key = ?", row.usage_key);
    return { changed: rows.length };
  }
  if (action === "reset_temperature") {
    const result = run(
      configDb,
      "update prompt_optimizer_providers set temperature = ?, updated_at = ? where enabled = 1 and temperature > ?",
      RECOMMENDED_TEMPERATURE,
      now(),
      HIGH_TEMPERATURE
    );
    return { changed: result.changes };
  }
  return null;
}
