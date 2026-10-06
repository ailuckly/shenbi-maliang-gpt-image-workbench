import { useState } from "react";
import { ChatMessage } from "../../components/chat/ChatMessages";
import { ImageLightbox, type ImageLightboxState } from "../../components/ImageLightbox";
import { useI18n } from "../../i18n";
import type { MessageRevision } from "../../lib/chatRender";
import { imageModelDisplayName } from "../../lib/imageModels";
import { sourceSnapshotFromMessage } from "../../lib/chatRequest";
import { workImageFromMessage } from "../../lib/workImages";
import type { ImageJob, Message, WorkImage } from "../../types";
import { Button, Tag } from "../ui";
import "./results.css";

// Number actual stored requests in chronological order, including revisions and failed requests.
export function imageVersionIndex(messages: Message[]) {
  const index=new Map<string,number>(), jobs=new Map<string,number>(); let number=0;
  for(const message of messages) if(message.role==="user") {index.set(message.id,++number);if(typeof message.metadata.jobId==="string")jobs.set(message.metadata.jobId,number);}
  let previous=0;
  for(const message of messages) {if(message.role==="user")previous=index.get(message.id)!;else if(message.imageId)index.set(message.imageId,jobs.get(String(message.metadata.jobId || "")) || previous);}
  return index;
}

export function resultSlots(user:Message, images:Message[]) {
  const count=Math.max(images.length,Math.min(10,Math.max(1,Number(user.metadata.n)||0,...images.map(image=>Number(image.metadata.imageTotal)||0),...images.map(image=>Number(image.metadata.imageIndex)||0))));
  const slots:Array<Message|null>=Array.from({length:Math.trunc(count)},()=>null), unassigned:Message[]=[];
  for(const image of images){const slot=Number(image.metadata.imageIndex)-1;if(Number.isInteger(slot)&&slot>=0&&slot<slots.length&&!slots[slot])slots[slot]=image;else unassigned.push(image);}
  for(const image of unassigned){const empty=slots.indexOf(null);if(empty>=0)slots[empty]=image;}
  return slots;
}

export function Results({revision,job,versions,sessionId,isSubmitting,retryingJobId,onRetry,onContinue,onOpenEditor,onAddAsset}:{
  revision:MessageRevision;job?:ImageJob;versions:ReadonlyMap<string,number>;sessionId?:string|null;isSubmitting:boolean;retryingJobId:string;
  onRetry:(id:string)=>void;onContinue:(image:WorkImage)=>void;onOpenEditor:(image:WorkImage)=>void;onAddAsset:(image:WorkImage)=>void;
}) {
  const {t}=useI18n();const [preview,setPreview]=useState<ImageLightboxState|null>(null);
  const {user}=revision, assistants=revision.assistants.length ? revision.assistants : revision.assistant ? [revision.assistant] : [];
  const images=assistants.filter(message=>message.imageId&&message.imageUrl),slots=resultSlots(user,images);
  const status=job?.status || (user.metadata.pending===true ? "running" : undefined),number=versions.get(user.id);
  const meta=user.metadata, style=meta.stylePackSnapshot && typeof meta.stylePackSnapshot==="object" ? meta.stylePackSnapshot as Record<string,unknown> : null;
  const text=(value:unknown)=>typeof value==="string" ? value : "";
  const finalPrompt=text(meta.finalPrompt) || user.content, negative=text(meta.negativePrompt),original=text(meta.originalRequest);
  const references=sourceSnapshotFromMessage(user).references;
  const retryable=status==="failed" && !!job && !isSubmitting && retryingJobId!==job.id;
  if(!job && !images.length && !meta.pending && !meta.mode)return null;
  return <section className="v2-results" aria-label={t("v2.result.title")}>
    <header className="v2-row"><h2>{number ? t("v2.result.version",{number}) : t("v2.result.title")}</h2><Tag>{status ? t(`v2.result.status.${status}`) : t("v2.result.status.unknown")}</Tag><span>{t("v2.result.savedCount",{saved:images.length,total:slots.length})}</span></header>
    {references.length ? <div className="v2-result-references">{references.map((reference,index)=>{const based=reference.kind==="image" ? versions.get(reference.id.replace(/^image:/,"")) : undefined;return <Button key={`${reference.kind}:${reference.id}:${index}`} onClick={()=>setPreview({items:references.map(item=>({url:item.originalUrl || item.previewUrl || item.url,thumbnailUrl:item.thumbnailUrl || item.url,name:item.name})),index})}><img src={reference.thumbnailUrl || reference.previewUrl || reference.url} alt=""/>{based ? t("v2.result.basedOn",{number:based}) : reference.name}</Button>;})}</div> : null}
    <details className="v2-result-prompt"><summary>{t("v2.composer.final")}</summary>{original ? <><h3>{t("v2.composer.original")}</h3><p>{original}</p></> : null}<h3>{t("v2.composer.positive")}</h3><p>{finalPrompt}</p>{negative ? <><h3>{t("v2.composer.negative")}</h3><p>{negative}</p></> : null}<dl><div><dt>{t("v2.shell.stylePacks")}</dt><dd>{text(style?.name) || t("v2.composer.noStyle")}</dd></div><div><dt>{t("v2.composer.count")}</dt><dd>{slots.length}</dd></div><div><dt>{t("v2.result.requestedModel")}</dt><dd>{text(meta.model) ? imageModelDisplayName(text(meta.model)) : t("v2.composer.providerDefault")}</dd></div><div><dt>{t("v2.composer.ratio")}</dt><dd>{text(meta.size) || t("v2.composer.providerDefault")}</dd></div><div><dt>{t("v2.composer.quality")}</dt><dd>{text(meta.quality) || t("v2.composer.providerDefault")}</dd></div></dl></details>
    <div className="v2-result-grid">{slots.map((message,slot)=>message ? <article key={message.id} className="v2-result-card"><header><strong>{t("v2.result.image",{number:slot+1})}</strong><Tag>{t("v2.result.saved")}</Tag></header><ChatMessage message={message} sessionId={sessionId} onOpenEditor={onOpenEditor} onAddAsset={onAddAsset} capabilities={{addCase:false}}/><dl className="v2-result-execution"><div><dt>{t(message.metadata.actualModel ? "v2.result.actualModel" : "v2.result.requestedModel")}</dt><dd>{imageModelDisplayName(text(message.metadata.actualModel) || text(message.metadata.requestedModel) || text(message.metadata.model) || text(meta.model)) || t("v2.composer.providerDefault")}</dd></div><div><dt>{t("v2.composer.ratio")}</dt><dd>{message.imageSize || text(meta.size) || t("v2.composer.providerDefault")}</dd></div><div><dt>{t("v2.composer.quality")}</dt><dd>{text(message.metadata.actualQuality) || message.imageQuality || text(meta.quality) || t("v2.composer.providerDefault")}</dd></div></dl><div className="v2-row"><Button disabled={isSubmitting} onClick={()=>{const image=workImageFromMessage(message,sessionId || null);if(image)onContinue(image);}}>{t("v2.result.continue")}</Button><Button onClick={()=>setPreview({items:images.map(image=>({url:image.imageOriginalUrl || image.imageUrl!,thumbnailUrl:image.imageThumbnailUrl || image.imageUrl!,name:t("v2.result.image",{number:Number(image.metadata.imageIndex)||images.indexOf(image)+1})})),index:images.indexOf(message)})}>{t("v2.result.original")}</Button></div></article> : <article key={`slot-${slot}`} className="v2-result-card v2-result-missing" role={status==="failed" ? "alert" : "status"}><strong>{t("v2.result.image",{number:slot+1})}</strong><p>{t(status==="running" ? "v2.result.pending" : status==="failed" ? "v2.result.missingFailed" : status==="cancelled" ? "v2.result.cancelled" : "v2.result.unavailable")}</p>{job?.error ? <p className="v2-result-error">{job.error}</p> : null}{status==="failed" && job ? <Button disabled={!retryable} onClick={()=>onRetry(job.id)}>{t(retryingJobId===job.id ? "rendering.retrying" : "v2.result.retryMissing")}</Button> : null}</article>)}</div>
    {assistants.filter(message=>!message.imageId||!message.imageUrl).map(message=><ChatMessage key={message.id} message={message} sessionId={sessionId}/>)}
    <ImageLightbox state={preview} onClose={()=>setPreview(null)} onChangeIndex={index=>setPreview(current=>current ? {...current,index} : null)}/>
  </section>;
}
