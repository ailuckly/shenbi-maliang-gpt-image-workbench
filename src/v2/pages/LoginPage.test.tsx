import { expect, test } from "bun:test";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderToStaticMarkup } from "react-dom/server";
import { ToastProvider } from "../ui";
import { LoginPage } from "./LoginPage";

test("registration visibility, native login fields and configurable source survive the redesign", () => {
  const render = (enabled: boolean, register = false) => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    client.setQueryData(["registration-status"], { enabled });
    client.setQueryData(["branding"], { siteName: "Test workspace", sourceCodeUrl: "https://example.com/source", showGithubEntry: true });
    const html = renderToStaticMarkup(<QueryClientProvider client={client}><ToastProvider><LoginPage initialMode={register ? "register" : "login"} /></ToastProvider></QueryClientProvider>);
    client.clear(); return html;
  };
  const closed = render(false), open = render(true), registration = render(true, true);
  expect(closed).toContain("没有账号？联系管理员"); expect(closed).not.toContain("没有账号？注册");
  expect(open).toContain("没有账号？注册"); expect(open).not.toContain("没有账号？联系管理员");
  expect(closed).toContain('href="https://example.com/source"'); expect(closed).toContain("Test workspace");
  expect(closed).toContain('autoComplete="username"'); expect(closed).toContain('autoComplete="current-password"');
  expect(closed).toContain("记住账号"); expect(closed).not.toContain("记住密码"); expect(closed).not.toContain("管理入口");
  expect(registration).toContain('id="register-email"'); expect(registration).toContain('id="register-code"');
  expect(registration).toContain('id="register-password"'); expect(registration).toContain('id="register-confirm"');
  expect(registration).toContain('autoComplete="one-time-code"');
});
