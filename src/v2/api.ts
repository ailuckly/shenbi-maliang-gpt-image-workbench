import { z } from "zod";
import { ApiError, request } from "../api/client";
import { parsePromptTemplateOptimizeFrame } from "../api/workbench";
import { structuredPromptSchema } from "../../server/promptEngine/schema";
import type { publicStylePack, stylePackInputSchema } from "../../server/stylePacks";

export type StylePack = Omit<ReturnType<typeof publicStylePack>,"recommendedParams"> & {recommendedParams: import("../../server/promptEngine/compose").PromptParams};
export type StylePackInput = z.infer<typeof stylePackInputSchema>;
export type PromptMode = "t2i" | "i2i" | "multi" | "iterate";
export const candidateSchema = z.object({ index:z.number().int().min(0).max(2), structured:structuredPromptSchema, finalPrompt:z.string().max(30000), negative:z.string().max(10000) });
export type PromptCandidate = z.infer<typeof candidateSchema>;
export type PromptGenerationFields = {
  originalRequest:string; optimizeMode:PromptMode; stylePackSnapshot:StylePack|null;
  selectedCandidateIndex?:number; finalPrompt:string; negativePrompt:string;
  promptCandidates?:PromptCandidate[]; templateId?:string; previousPrompt?:string; followUp?:string;
};
export type PromptDraft = {
  continuationImageId?:string; candidateCount?:number; mode?:PromptMode; stylePackSnapshot?:StylePack|null; candidates?:PromptCandidate[]; selectedCandidateIndex?:number;
  finalPrompt?:string; negativePrompt?:string; manuallyEdited?:boolean; templateId?:string;
  previousPrompt?:string; followUp?:string; explicitParams?:{size?:boolean;quality?:boolean;n?:boolean};
};
const stylePackSchema = z.object({id:z.string().min(1).max(128),scope:z.enum(["system","user"]),groupKey:z.string().max(96),name:z.string().max(40),description:z.string().max(200),optimizeInstruction:z.string().max(2000),promptPrefix:z.string().max(2000),promptSuffix:z.string().max(2000),negativePrompt:z.string().max(2000),recommendedParams:z.object({aspectRatio:z.string().optional(),quality:z.string().optional(),n:z.number().int().min(1).max(10).optional()}).strict(),sourceNote:z.string().max(500),enabled:z.boolean(),sortOrder:z.number().int(),createdAt:z.string(),updatedAt:z.string()}).strict();
export const promptDraftSchema = z.object({continuationImageId:z.string().min(1).max(128).optional(),candidateCount:z.number().int().min(1).max(3).optional(),mode:z.enum(["t2i","i2i","multi","iterate"]).optional(),stylePackSnapshot:stylePackSchema.nullable().optional(),candidates:z.array(candidateSchema).max(3).optional(),selectedCandidateIndex:z.number().int().min(0).max(2).optional(),finalPrompt:z.string().max(30000).optional(),negativePrompt:z.string().max(10000).optional(),manuallyEdited:z.boolean().optional(),templateId:z.string().max(128).optional(),previousPrompt:z.string().max(30000).optional(),followUp:z.string().max(10000).optional(),explicitParams:z.object({size:z.boolean().optional(),quality:z.boolean().optional(),n:z.boolean().optional()}).optional()});
export function normalizePromptDraft(value:unknown):PromptDraft|undefined {const parsed=promptDraftSchema.safeParse(value);return parsed.success ? parsed.data : undefined;}
const optimizeMetadataSchema=z.object({templateId:z.string().max(128),stylePackSnapshot:stylePackSchema.nullable()});
const optimizeResultSchema=optimizeMetadataSchema.extend({candidates:z.array(candidateSchema).min(1).max(3),errors:z.array(z.object({index:z.number().int().min(0).max(2),error:z.string()})),providerName:z.string(),model:z.string()});
export type OptimizeRequest = {prompt:string;mode:PromptMode;language:"zh"|"en";candidates:number;stylePackId?:string;previousPrompt?:string;followUp?:string;referenceCount:number;referenceSummary?:string;imageCount:number};
export type OptimizeResult = {candidates:PromptCandidate[];errors:{index:number;error:string}[];templateId:string;stylePackSnapshot:StylePack|null;providerName:string;model:string};

export const stylePackApi = {
  list: (admin=false, signal?:AbortSignal) => request<{stylePacks:StylePack[]}>(admin ? "/api/config/style-packs" : "/api/style-packs",{signal}),
  save: (payload:StylePackInput, id?:string, admin=false) => request<{stylePack:StylePack}>(`/api/${admin ? "config/" : ""}style-packs${id ? "/"+encodeURIComponent(id) : ""}`,{method:id ? "PATCH" : "POST",body:JSON.stringify(payload)}),
  remove: (id:string,admin=false) => request<{ok:boolean}>(`/api/${admin ? "config/" : ""}style-packs/${encodeURIComponent(id)}`,{method:"DELETE"}),
  preview: (payload:{prompt:string;negativePrompt?:string;stylePackId?:string;stylePack?:StylePackInput;manuallyEdited?:boolean},signal?:AbortSignal) => request<{finalPrompt:string;negative:string;params:StylePack["recommendedParams"]}>("/api/style-packs/preview",{method:"POST",body:JSON.stringify(payload),signal})
};

// Completed candidates are delivered before done, so cancellation keeps usable work.
export async function optimizePrompt(payload:OptimizeRequest, signal:AbortSignal, onCandidate:(candidate:PromptCandidate)=>void, onCandidateError:(failure:{index:number;error:string})=>void, onMetadata?:(metadata:Pick<OptimizeResult,"templateId"|"stylePackSnapshot">)=>void):Promise<OptimizeResult> {
  const response=await fetch("/api/prompt-optimizer/optimize",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json",Accept:"text/event-stream, application/json"},body:JSON.stringify(payload),signal:AbortSignal.any([signal,AbortSignal.timeout(95000)])});
  if (!response.ok) {const body=await response.json().catch(()=>({}));throw new ApiError(String(body.error || response.statusText),response.status);}
  if (!response.headers.get("content-type")?.includes("text/event-stream")) {
    const data=optimizeResultSchema.parse(await response.json()); onMetadata?.(data);
    data.candidates.forEach(onCandidate); (data.errors || []).forEach(onCandidateError); return data;
  }
  if (!response.body) throw new ApiError("浏览器不支持流式响应",500);
  const reader=response.body.getReader(); const decoder=new TextDecoder(); let buffer=""; let result:OptimizeResult|undefined;
  const frame=(text:string)=>{const {event,data}=parsePromptTemplateOptimizeFrame(text); const record=data as Record<string,unknown>;
    if(event==="meta") onMetadata?.(optimizeMetadataSchema.parse(data));
    if(event==="candidate") onCandidate(candidateSchema.parse(data));
    if(event==="candidate-error") onCandidateError(z.object({index:z.number().int().min(0).max(2),error:z.string()}).parse(data));
    if(event==="error") throw new ApiError(String(record.error || "AI 优化失败"),502);
    if(event==="done") {result=optimizeResultSchema.parse(data);onMetadata?.(result);}
  };
  try {for(;;){const {value,done}=await reader.read(); buffer+=(value ? decoder.decode(value,{stream:true}) : done ? decoder.decode() : "");buffer=buffer.replace(/\r\n/g,"\n");let boundary;
    while((boundary=buffer.indexOf("\n\n"))>=0){frame(buffer.slice(0,boundary));buffer=buffer.slice(boundary+2);}if(done)break;
  }if(buffer.trim())frame(buffer);if(!result)throw new ApiError("流式优化响应未完成，请重试",502);return result;
  } finally {await reader.cancel().catch(()=>undefined);reader.releaseLock();}
}
