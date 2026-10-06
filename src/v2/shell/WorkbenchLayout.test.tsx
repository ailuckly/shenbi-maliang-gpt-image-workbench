import { expect, test } from "bun:test";
import { createRef, type ComponentProps } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WorkbenchLayout } from "./WorkbenchLayout";
import { ToastProvider } from "../ui";
import type { ChatSession, User } from "../../types";

test("navigation keeps conversation links, honest job status and hidden upstream modules", () => {
  const client = new QueryClient();
  const session = { id: "test-session", title: "<test title>", titleStatus: "ready", pinnedAt: null, runningImageJobCount: 0 } as ChatSession;
  const noop = () => undefined;
  const props: ComponentProps<typeof WorkbenchLayout> = {
    user: { username: "Test", account: "test" } as User, siteName: "Test workspace", sourceCodeUrl: "https://example.com/source", mobileOpen: false, onMobileOpenChange: noop,
    sessions: [session], loading: false, hasMore: false, loadingMore: false, sentinel: createRef(), pending: false, preferencesSaving: false,
    onLoadMore: noop, onNew: noop, onSearch: noop, onSettings: noop, onLogout: noop, onTheme: noop, onLanguage: noop,
    onRename: noop, onPin: noop, onArchive: noop, onDelete: noop, onSessionOpen: noop, onNavigate: noop, children: <main>Content</main>
  };
  const render = () => renderToStaticMarkup(<MemoryRouter initialEntries={["/chat/test-session"]}><QueryClientProvider client={client}><ToastProvider><WorkbenchLayout {...props} /></ToastProvider></QueryClientProvider></MemoryRouter>);
  const html = render();
  expect(html).toContain('href="/chat/test-session"'); expect(html).toContain('&lt;test title&gt;'); expect(html).toContain('aria-current="page"');
  for (const path of ["/images", "/assets", "/style-packs"]) expect(html).toContain(`href="${path}"`);
  for (const path of ["/cases", "/cases/barrage", "/image-provenance", "/prompt-templates"]) expect(html).not.toContain(`href="${path}"`);
  expect(html).toContain('href="https://example.com/source"'); expect(html).not.toContain("图片生成中");
  props.sessions = [{ ...session, runningImageJobCount: 1 }];
  expect(render()).toContain("图片生成中");
  props.sessions = []; expect(render()).toContain("暂无聊天");
  client.clear();
});
