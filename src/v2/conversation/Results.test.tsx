import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { ToastProvider } from "../../ui";
import type { ImageJob, Message } from "../../types";
import type { MessageRevision } from "../../lib/chatRender";
import { imageVersionIndex, resultSlots, Results } from "./Results";
import { normalizePromptDraft } from "../api";

// These messages are test-only fixtures; no production job, image or provider response is fabricated.
test("results retain out-of-order completed slots, immutable prompts, actual models and reference versions",()=>{
  const base:Message={id:"request-1",role:"user",content:"assembled",imageId:null,imageUrl:null,imagePrompt:null,imageKind:null,imageSize:null,imageQuality:null,imageProviderId:null,parentImageId:null,metadata:{jobId:"job-1",mode:"generation",n:3,model:"requested-custom",finalPrompt:"immutable final",originalRequest:"original unchanged",negativePrompt:"immutable negative",stylePackSnapshot:{name:"Historical style"}},createdAt:"2026-01-01T00:00:00Z"};
  const image:Message={...base,id:"result-3",role:"assistant",imageId:"image-3",imageUrl:"/test-only-image.png",imageOriginalUrl:"/test-only-original.png",imageKind:"generation",imageSize:"1024x1024",metadata:{jobId:"job-1",imageIndex:3,imageTotal:3,actualModel:"actual-supplier-id",actualQuality:"actual-quality"}};
  const next:Message={...base,id:"request-2",metadata:{...base.metadata,jobId:"job-2",sourceImageIds:["image-3"]},imageId:"image-3",referenceImageKind:"image",referenceImageUrl:"/test-only-image.png"};
  const versions=imageVersionIndex([base,next,image]);expect(versions.get(base.id)).toBe(1);expect(versions.get(next.id)).toBe(2);expect(versions.get("image-3")).toBe(1);
  expect(resultSlots(base,[image]).map(item=>item?.id || null)).toEqual([null,null,"result-3"]);
  expect(resultSlots({...base,metadata:{n:1}},Array.from({length:12},(_,i)=>({...image,id:String(i),metadata:{}}))).filter(Boolean)).toHaveLength(12);
  const revision:MessageRevision={user:base,assistant:image,assistants:[image],rootId:base.id,branchId:"main",parentBranchId:"",branchForkMessageId:"",branchRootMessageId:base.id,order:0};
  const job:ImageJob={id:"job-1",type:"generation",status:"failed",prompt:"immutable final",providerId:"test only",error:"Supplier failure",resultImageId:image.imageId,createdAt:base.createdAt,updatedAt:base.createdAt};
  const render=(user=base,status=job.status)=>renderToStaticMarkup(<MemoryRouter><ToastProvider><Results revision={{...revision,user}} job={{...job,status}} versions={versions} sessionId="test-only" isSubmitting={false} retryingJobId="" onRetry={()=>{}} onContinue={()=>{}} onOpenEditor={()=>{}} onAddAsset={()=>{}}/></ToastProvider></MemoryRouter>);
  const html=render();expect(html).toContain('src="/test-only-image.png"');expect(html).toContain("actual-supplier-id");expect(html).toContain("actual-quality");expect(html).toContain("Historical style");expect(html).toContain("immutable final");expect(html).toContain("immutable negative");expect(html).toContain("original unchanged");expect(html.match(/重试未完成部分/g)).toHaveLength(2);expect(html).toContain("已保存 1 / 3 张");
  expect(render(next)).toContain("基于第 1 版");const running=render(base,"running");expect(running).toContain('src="/test-only-image.png"');expect(running).not.toContain("重试未完成部分");expect(render(base,"cancelled")).toContain("任务已取消，已保存图片仍保留");
  expect(normalizePromptDraft({continuationImageId:"image-3",mode:"i2i"})).toMatchObject({continuationImageId:"image-3"});expect(normalizePromptDraft({continuationImageId:[],mode:"i2i"})).toBeUndefined();
});
