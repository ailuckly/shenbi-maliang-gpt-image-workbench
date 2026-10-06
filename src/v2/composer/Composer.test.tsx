import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Composer } from "./Composer";
import { parseStructuredPrompt } from "../../../server/promptEngine/schema";
import type { PromptDraft, StylePack } from "../api";

test("review keeps the original, adopted candidate and manual final prompt separate",()=>{
  const pack:StylePack={id:"test",scope:"user",groupKey:"test",name:"测试风格",description:"",optimizeInstruction:"",promptPrefix:"PREFIX",promptSuffix:"SUFFIX",negativePrompt:"blur",recommendedParams:{},sourceNote:"",enabled:true,sortOrder:0,createdAt:"",updatedAt:""};
  const render=(draft:PromptDraft,refs=0)=>renderToStaticMarkup(<QueryClientProvider client={new QueryClient()}><Composer draftPrompt="原始需求必须保留" onDraftPromptChange={()=>{}} draft={draft} onDraftChange={()=>{}} previews={Array.from({length:refs},(_,i)=>({id:String(i),url:"/reference.png",name:"reference",title:"",onRemove:()=>{}}))} onUpload={async()=>{}} onPaste={()=>{}} uploadPending={false} selectedAssets={[]} onToggleAsset={()=>{}} onSelectedAssetsChange={()=>{}} busy={false} error="" onSubmit={()=>{}} imageModel="custom" imageModels={[]} onImageModelChange={()=>{}} size="" sizeOptions={[]} onSizeChange={()=>{}} quality="auto" qualityOptions={[]} onQualityChange={()=>{}} imageCount={1} onImageCountChange={()=>{}} textareaRef={{current:null}}/></QueryClientProvider>);
  const candidate={index:2,structured:parseStructuredPrompt("优化结果"),finalPrompt:"PREFIX\n优化结果\nSUFFIX",negative:"blur"};
  const html=render({stylePackSnapshot:pack,candidates:[candidate],selectedCandidateIndex:2});
  expect(html).toContain('id="v2-original-request"');expect(html).toContain("原始需求必须保留");expect(html).toContain("候选 3");expect(html).toContain("已采用");expect(html).toContain("PREFIX\n优化结果\nSUFFIX");
  expect(html).toContain("未配置可用模型");expect(html).not.toContain("宽高比</label>");expect(html).not.toContain("质量</label>");
  const manual=render({stylePackSnapshot:pack,manuallyEdited:true,finalPrompt:"手写正文",negativePrompt:"手写负面"});expect(manual).toContain(">手写正文</textarea>");expect(manual).toContain(">手写负面</textarea>");expect(manual).toContain("已手动修改");
  expect(render({},1)).toContain("自动 · 图生图");expect(render({},2)).toContain("自动 · 多图参考");
});
