import {
  Activity,
  ArrowDown,
  ArrowUp,
  Archive,
  Bot,
  Bug,
  Check,
  Database,
  Download,
  FolderOpen,
  ImageIcon,
  KeyRound,
  Lightbulb,
  LoaderCircle,
  LogOut,
  Mail,
  Network,
  PanelLeft,
  Pencil,
  ScrollText,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Shield,
  ShieldCheck,
  SlidersHorizontal,
  Smartphone,
  Tags,
  Trash2,
  Upload,
  Users,
  Volume2,
  WandSparkles
} from "lucide-react";

export const CONFIG_TAB_STORAGE_KEY = "gpt-image.config.activeTab";
export const CONFIG_SIDE_COLLAPSED_STORAGE_KEY = "gpt-image.config.sidebarCollapsed";
export const CONFIG_TAB_VALUES = [
  "setup",
  "statistics",
  "users",
  "teams",
  "userTiers",
  "contentCategories",
  "soundManagement",
  "assetReviews",
  "caseReviews",
  "imageAccounts",
  "providers",
  "promptOptimizer",
  "stylePacks",
  "caseLibrary",
  "imageCategories",
  "promptStrategy",
  "safetyReview",
  "smtp",
  "sms",
  "starterCopy",
  "branding",
  "imageMode",
  "cpa",
  "backup",
  "proxy",
  "debug",
  "changelog",
  "modelLogs",
  "requests",
  "audit"
] as const;

export type ConfigTabValue = (typeof CONFIG_TAB_VALUES)[number];
export type ConfigNavCategoryValue = "overview" | "generation" | "prompt" | "content" | "members" | "system";
export type ConfigNavItem = {
  value: ConfigTabValue;
  label: string;
  Icon: typeof Activity;
};

export const CONFIG_NAV_ITEMS: ConfigNavItem[] = [
  { value: "setup", label: "快速设置", Icon: Check },
  { value: "statistics", label: "数据统计", Icon: Activity },
  { value: "users", label: "用户账号", Icon: Users },
  { value: "teams", label: "团队管理", Icon: Shield },
  { value: "userTiers", label: "用户等级", Icon: ShieldCheck },
  { value: "contentCategories", label: "分类管理", Icon: Tags },
  { value: "soundManagement", label: "提示音管理", Icon: Volume2 },
  { value: "assetReviews", label: "素材审核", Icon: FolderOpen },
  { value: "caseReviews", label: "灵感审核", Icon: Lightbulb },
  { value: "imageAccounts", label: "账号池", Icon: ShieldCheck },
  { value: "providers", label: "渠道配置", Icon: KeyRound },
  { value: "promptOptimizer", label: "模型配置", Icon: WandSparkles },
  { value: "stylePacks", label: "风格包", Icon: Tags },
  { value: "caseLibrary", label: "案例库", Icon: Lightbulb },
  { value: "imageCategories", label: "图类模板", Icon: ScrollText },
  { value: "promptStrategy", label: "优化策略", Icon: SlidersHorizontal },
  { value: "safetyReview", label: "安全审核", Icon: ShieldCheck },
  { value: "smtp", label: "邮件配置", Icon: Mail },
  { value: "sms", label: "短信配置", Icon: Smartphone },
  { value: "starterCopy", label: "空白页文案", Icon: Bot },
  { value: "branding", label: "站点与品牌", Icon: ImageIcon },
  { value: "imageMode", label: "模式配置", Icon: SlidersHorizontal },
  { value: "cpa", label: "CPA 同步", Icon: RefreshCw },
  { value: "backup", label: "数据备份", Icon: Archive },
  { value: "proxy", label: "代理配置", Icon: Network },
  { value: "debug", label: "调试配置", Icon: Bug },
  { value: "changelog", label: "更新日志", Icon: ScrollText },
  { value: "modelLogs", label: "模型日志", Icon: Bot },
  { value: "requests", label: "请求日志", Icon: Activity },
  { value: "audit", label: "审计", Icon: Database }
];

export const CONFIG_NAV_CATEGORIES: Array<{
  value: ConfigNavCategoryValue;
  label: string;
  items: ConfigTabValue[];
}> = [
  { value: "overview", label: "概览", items: ["setup", "statistics"] },
  { value: "generation", label: "模型与渠道", items: ["providers", "promptOptimizer", "imageMode", "safetyReview", "imageAccounts", "cpa"] },
  { value: "prompt", label: "提示词工程", items: ["stylePacks", "imageCategories", "caseLibrary", "promptStrategy"] },
  { value: "content", label: "内容", items: ["contentCategories", "soundManagement", "assetReviews", "caseReviews", "starterCopy", "changelog"] },
  { value: "members", label: "组织", items: ["users", "teams", "userTiers"] },
  { value: "system", label: "系统", items: ["branding", "smtp", "sms", "backup", "proxy", "debug", "modelLogs", "requests", "audit"] }
];

export function isConfigTabValue(value: string | null | undefined): value is ConfigTabValue {
  return Boolean(value) && CONFIG_TAB_VALUES.includes(value as ConfigTabValue);
}

export function configNavItemsForCategory(categoryValue: ConfigNavCategoryValue) {
  const category = CONFIG_NAV_CATEGORIES.find((item) => item.value === categoryValue) ?? CONFIG_NAV_CATEGORIES[0];
  return category.items
    .map((value) => CONFIG_NAV_ITEMS.find((item) => item.value === value))
    .filter((item): item is ConfigNavItem => Boolean(item));
}

export function configTabVisible(tab: ConfigTabValue, features: Partial<Record<string, boolean>>) {
  const switchType = { imageAccounts: "chatgpt_web_entry", cpa: "cpa_sync", sms: "sms_service", soundManagement: "sound_management_entry" }[tab as string];
  return !switchType || features[switchType] === true;
}

export function storedConfigTab(): ConfigTabValue {
  try {
    const value = window.localStorage.getItem(CONFIG_TAB_STORAGE_KEY);
    if (value === "file") return "debug";
    return isConfigTabValue(value) ? value : "setup";
  } catch {
    return "setup";
  }
}

export function storedConfigSideCollapsed() {
  try {
    return window.localStorage.getItem(CONFIG_SIDE_COLLAPSED_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}
