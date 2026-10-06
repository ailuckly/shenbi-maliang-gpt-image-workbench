import { expect, test } from "bun:test";
import { optimizePrompt, normalizePromptDraft, type PromptCandidate, type OptimizeResult } from "./api";
import { parseStructuredPrompt } from "../../server/promptEngine/schema";

// Network substitutes live only in this test; no production provider or image record is created.
test("candidate SSE preserves completed work across partial failures, truncation and cancellation", async () => {
  const originalFetch=globalThis.fetch;
  const candidate:PromptCandidate={index:0,structured:parseStructuredPrompt("测试主体"),finalPrompt:"测试主体",negative:""};
  const result:OptimizeResult={candidates:[candidate],errors:[{index:1,error:"测试候选失败"}],templateId:"test",stylePackSnapshot:null,providerName:"test only",model:"test"};
  const frame=(event:string,data:unknown)=>`event: ${event}\r\ndata: ${JSON.stringify(data)}\r\n\r\n`;
  const payload={prompt:"原始需求",mode:"t2i" as const,language:"zh" as const,candidates:2,referenceCount:0,imageCount:1};
  const encoder=new TextEncoder();
  const install=(text:string)=>{const bytes=encoder.encode(text);globalThis.fetch=(async()=>new Response(new ReadableStream({start(output){for(let i=0;i<bytes.length;i+=3)output.enqueue(bytes.slice(i,i+3));output.close();}}),{headers:{"content-type":"text/event-stream"}})) as unknown as typeof fetch;};
  try {
    const seen:PromptCandidate[]=[], failures:unknown[]=[],metadata:unknown[]=[];
    install(frame("meta",{templateId:"test",stylePackSnapshot:null})+frame("candidate",candidate)+frame("candidate-error",result.errors[0])+frame("done",result));
    expect(await optimizePrompt(payload,new AbortController().signal,item=>seen.push(item),item=>failures.push(item),item=>metadata.push(item))).toEqual(result);
    expect(seen).toEqual([candidate]);expect(failures).toEqual(result.errors);expect(metadata[0]).toEqual({templateId:"test",stylePackSnapshot:null});
    install(frame("candidate",candidate));const partial:PromptCandidate[]=[];
    await expect(optimizePrompt(payload,new AbortController().signal,item=>partial.push(item),()=>{})).rejects.toThrow("流式优化响应未完成");expect(partial).toEqual([candidate]);
    install(frame("candidate",candidate)+frame("error",{error:"真实格式错误示例"}));await expect(optimizePrompt(payload,new AbortController().signal,()=>{},()=>{})).rejects.toThrow("真实格式错误示例");
    const cancellation=new AbortController(),kept:PromptCandidate[]=[];
    globalThis.fetch=(async(_url:RequestInfo|URL,init?:RequestInit)=>new Response(new ReadableStream({start(output){output.enqueue(encoder.encode(frame("candidate",candidate)));init?.signal?.addEventListener("abort",()=>output.error(new DOMException("Cancelled","AbortError")),{once:true});}}),{headers:{"content-type":"text/event-stream"}})) as unknown as typeof fetch;
    await expect(optimizePrompt(payload,cancellation.signal,item=>{kept.push(item);cancellation.abort();},()=>{})).rejects.toThrow("Cancelled");expect(kept).toEqual([candidate]);
    expect(normalizePromptDraft({candidates:"corrupt storage"})).toBeUndefined();expect(normalizePromptDraft({candidates:[candidate],manuallyEdited:true,finalPrompt:"用户手写",negativePrompt:"原文"})).toMatchObject({manuallyEdited:true,finalPrompt:"用户手写"});
  } finally {globalThis.fetch=originalFetch;}
});
