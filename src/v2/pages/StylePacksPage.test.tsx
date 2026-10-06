import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ToastProvider } from "../../ui";
import type { StylePack } from "../api";
import { stylePackFields, StylePacksPage } from "./StylePacksPage";

test("system styles expose copy controls and editable payloads omit identity and owner fields",()=>{
  const pack:StylePack={id:"system:test",scope:"system",groupKey:"group",name:"Test system style",description:"Read-only system rules",optimizeInstruction:"instruction",promptPrefix:"prefix",promptSuffix:"suffix",negativePrompt:"blur",recommendedParams:{n:2},sourceNote:"source",enabled:true,sortOrder:0,createdAt:"",updatedAt:""};
  const cache=new QueryClient();cache.setQueryData(["style-packs"],{stylePacks:[pack]});
  const html=renderToStaticMarkup(<QueryClientProvider client={cache}><ToastProvider><StylePacksPage/></ToastProvider></QueryClientProvider>);
  expect(html).toContain("系统风格");expect(html).toContain("我的风格");expect(html).toContain("复制为我的");expect(html).toContain("Test system style");expect(html).not.toContain('name="apiKey"');
  expect(stylePackFields(pack)).toMatchObject({name:pack.name,promptPrefix:"prefix",recommendedParams:{n:2}});expect(Object.keys(stylePackFields(pack))).not.toContain("id");expect(Object.keys(stylePackFields(pack))).not.toContain("scope");
});

test("admin style lists expose system ordering and hide the private copy action",()=>{
 const cache=new QueryClient();cache.setQueryData(["config-style-packs"],{stylePacks:[{id:"admin:pack",scope:"system",groupKey:"group",name:"Admin system",enabled:false,sortOrder:0}]});
 const html=renderToStaticMarkup(<QueryClientProvider client={cache}><ToastProvider><StylePacksPage admin/></ToastProvider></QueryClientProvider>);
 expect(html).toContain("Admin system");expect(html).toContain("上移");expect(html).toContain("下移");expect(html).toContain("已停用");expect(html).not.toContain("复制为我的");expect(html).not.toContain("我的风格");
});
