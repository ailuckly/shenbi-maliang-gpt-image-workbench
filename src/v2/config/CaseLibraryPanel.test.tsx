import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ToastProvider } from "../ui";
import { v2Messages } from "../../i18n/messages/v2";
import { CaseLibraryPanel } from "./CaseLibraryPanel";

test("case library shows each source license, counts and sync failures, and locks sync during a run", () => {
  const cache = new QueryClient();
  const idle = { running: false, total: 0, processed: 0, failed: 0, error: "", finishedAt: "" };
  const data = { ...idle, count: 3, sources: [
    { id: "awesome-gpt-image-2", name: "awesome-gpt-image-2", license: "MIT", count: 1, status: idle },
    { id: "nanobanana-cn", name: "Nano Banana 中文精选", license: "MIT", count: 2, status: idle },
    { id: "youmind", name: "YouMind Nano Banana Pro", license: "CC BY 4.0", count: 0, status: { ...idle, error: "fixture download failed", finishedAt: "2026-10-07" } }
  ] };
  const render = () => renderToStaticMarkup(<QueryClientProvider client={cache}><ToastProvider><CaseLibraryPanel /></ToastProvider></QueryClientProvider>);
  cache.setQueryData(["config-case-library"], data);
  let html = render();
  for (const source of data.sources) expect(html).toContain(source.name);
  expect(html).toContain("CC BY 4.0");
  expect(html).toContain("已同步 3 个案例");
  expect(html).toContain("已同步 2 个案例");
  expect(html).toContain("fixture download failed");
  expect(html.match(/<button/g)).toHaveLength(4);
  expect(html).not.toContain('disabled=""');
  cache.setQueryData(["config-case-library"], { ...data, running: true, total: 4, processed: 1, sources: data.sources.map((source, index) => index === 1 ? { ...source, status: { ...idle, running: true, total: 2, processed: 1 } } : source) });
  html = render();
  expect(html.match(/disabled=""/g)).toHaveLength(4);
  expect(html).toContain("进度 1 / 2");
  for (const key of ["sourcesDescription", "license", "syncSource"]) {
    expect(v2Messages["zh-CN"][`v2.caseLibrary.${key}`]).toBeTruthy();
    expect(v2Messages["en-US"][`v2.caseLibrary.${key}`]).toBeTruthy();
  }
  cache.clear();
});
