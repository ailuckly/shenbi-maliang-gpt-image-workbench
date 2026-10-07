import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { v2Messages } from "../../i18n/messages/v2";
import { configNavItemsForCategory, configTabVisible } from "../../config/configNav";
import { AccountSearchPanel, TeamAccountPanel } from "../../config/panels/members";
import { UserTiersPanel } from "./UserTiersPanel";

const tier = { id: "basic", name: "基础", description: "Basic limits", allowedModels: ["gpt-image-*"], maxQuality: "high" as const, dailyImageLimit: 20, dailyOptimizeLimit: 30, isDefault: true, sortOrder: 0, createdAt: "", updatedAt: "" };
function render(panel: React.ReactNode) {
  const cache = new QueryClient({ defaultOptions: { queries: { enabled: false, retry: false } } });
  cache.setQueryData(["config-user-tiers"], { tiers: [tier] });
  cache.setQueryData(["config-teams"], { teams: [{ id: "team", name: "Team", description: "", userCount: 2 }] });
  cache.setQueryData(["config-users", { keyword: "", teamFilter: "team", tierFilter: "", statusFilter: "" }], { users: [{ id: "A", username: "Alice", account: "alice", tierId: "basic", tier, today: { images: 3, optimizes: 4, checks: 5 }, teamName: "Team", teamId: "team", email: "", phone: "", lastLoginAt: "", createdAt: "", updatedAt: "", disabled: false, hasConfigAccess: false, sessionCount: 0, imageCount: 3 }] });
  cache.setQueryData(["config-registration-settings"], { settings: { enabled: false } });
  return renderToStaticMarkup(<QueryClientProvider client={cache}>{panel}</QueryClientProvider>);
}

test("organization navigation contains tiers and optional channel tabs require their own switches", () => {
  expect(configNavItemsForCategory("members").map(item => item.value)).toEqual(["users", "teams", "userTiers"]);
  for (const [tab, feature] of [["imageAccounts", "chatgpt_web_entry"], ["cpa", "cpa_sync"]] as const) {
    expect(configTabVisible(tab, {})).toBe(false);
    expect(configTabVisible(tab, { [feature]: false })).toBe(false);
    expect(configTabVisible(tab, { [feature]: true })).toBe(true);
  }
});

test("tier list renders limits/default protection, user list shows tier/today, team page has no account editor", () => {
  const tiers = render(<UserTiersPanel />);
  expect(tiers).toContain("gpt-image-*"); expect(tiers).toContain("20"); expect(tiers).toContain("30");
  expect(tiers).toContain('disabled=""'); expect(tiers).not.toContain("v2.tiers.");
  const users = render(<AccountSearchPanel initialTeamId="team" />);
  expect(users).toContain("Alice"); expect(users).toContain("基础");
  expect(users).toContain("3"); expect(users).toContain("4"); expect(users).toContain("5");
  const teams = render(<TeamAccountPanel onUsers={() => {}} />);
  expect(teams).toContain("Team"); expect(teams).toContain(">2</button>");
  expect(teams).not.toContain("新增账号"); expect(teams).not.toContain("重置密码"); expect(teams).not.toContain("UserDialog");
});

test("all new tier UI keys exist in Chinese and English", () => {
  const keys = Object.keys(v2Messages["zh-CN"]).filter(key => key.startsWith("v2.tiers.") || key === "config.nav.userTiers");
  expect(keys.length).toBeGreaterThan(25);
  for (const key of keys) {
    expect(v2Messages["zh-CN"][key]).toBeTruthy(); expect(v2Messages["en-US"][key]).toBeTruthy();
  }
});
