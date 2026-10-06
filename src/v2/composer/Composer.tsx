import { useEffect, useRef, useState, type ClipboardEventHandler, type RefObject } from "react";
import { useQuery } from "@tanstack/react-query";
import { ImagePlus, X } from "lucide-react";
import { useI18n } from "../../i18n";
import { MaterialPicker } from "../../components/MaterialPicker";
import { ImageLightbox, type ImageLightboxState } from "../../components/ImageLightbox";
import type { ChatComposerPreview } from "../../components/chat/ChatComposer";
import type { AssetItem } from "../../types";
import type { ImageModelId, ImageQuality } from "../../lib/imageModels";
import { imageModelDisplayName, isImageQualitySupported } from "../../lib/imageModels";
import type { QualityOption, SizeOption } from "../../lib/imageOptions";
import { splitPlainPrompt } from "../../../server/promptEngine/schema";
import { composePrompt } from "../../../server/promptEngine/compose";
import { optimizePrompt, stylePackApi, type PromptDraft, type PromptGenerationFields, type PromptMode, type StylePack } from "../api";
import { Button, Dialog, EmptyState, ErrorState, Input, Select, Tag, Textarea } from "../ui";
import "./composer.css";

type Props = {
  draftPrompt:string; onDraftPromptChange:(value:string)=>void; draft:PromptDraft; onDraftChange:(draft:PromptDraft)=>void;
  previews:ChatComposerPreview[]; continuityPreview?:ChatComposerPreview; onUpload:(files:File[])=>Promise<void>; onPaste:ClipboardEventHandler<HTMLTextAreaElement>; uploadPending:boolean;
  selectedAssets:AssetItem[]; onToggleAsset:(asset:AssetItem)=>void; onSelectedAssetsChange:(assets:AssetItem[])=>void;
  busy:boolean; cancelPending?:boolean; onCancel?:()=>void; error:string; onSubmit:(fields:PromptGenerationFields)=>void;
  imageModel:ImageModelId; imageModels:string[]; onImageModelChange:(value:ImageModelId)=>void;
  size:string; sizeOptions:SizeOption[]; onSizeChange:(value:string)=>void;
  quality:ImageQuality; qualityOptions:QualityOption[]; onQualityChange:(value:ImageQuality)=>void;
  imageCount:number; onImageCountChange:(value:number)=>void; textareaRef:RefObject<HTMLTextAreaElement|null>;
};

export function Composer(props:Props) {
  const {t,resolvedLanguage}=useI18n(); const candidateCount=props.draft.candidateCount || 1;
  const [optimizing,setOptimizing]=useState(false); const [optimizeError,setOptimizeError]=useState(""); const [failures,setFailures]=useState<{index:number;error:string}[]>([]);
  const [materialOpen,setMaterialOpen]=useState(false); const [lightbox,setLightbox]=useState<ImageLightboxState|null>(null); const [formError,setFormError]=useState("");
  const controller=useRef<AbortController|null>(null); const fileRef=useRef<HTMLInputElement|null>(null); const materialTrigger=useRef<HTMLButtonElement|null>(null); const optimizeTrigger=useRef<HTMLButtonElement|null>(null); const generateTrigger=useRef<HTMLButtonElement|null>(null); const mounted=useRef(true); const draftRef=useRef(props.draft); draftRef.current=props.draft;
  const packs=useQuery({queryKey:["style-packs"],queryFn:({signal})=>stylePackApi.list(false,signal)});
  const enabledPacks=(packs.data?.stylePacks || []).filter(pack=>pack.enabled);
  const groups=[...new Set(enabledPacks.map(pack=>pack.groupKey))]; const pack=props.draft.stylePackSnapshot || null;
  const previews=props.previews.length ? props.previews : props.continuityPreview ? [props.continuityPreview] : [];
  const automaticMode=previews.length>1 ? "multi" : previews.length ? "i2i" : "t2i";
  const mode=props.draft.mode || automaticMode;
  const selected=props.draft.candidates?.find(candidate=>candidate.index===props.draft.selectedCandidateIndex);
  const plain=splitPlainPrompt(props.draftPrompt,{stripHeadings:false});
  const composed=composePrompt({prompt:props.draft.finalPrompt !== undefined ? props.draft.finalPrompt || "" : selected?.structured.finalPrompt ?? plain.prompt,
    negativePrompt:props.draft.finalPrompt !== undefined ? props.draft.negativePrompt : selected?.structured.negative ?? plain.negativePrompt,stylePack:pack,manuallyEdited:props.draft.finalPrompt !== undefined});
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;controller.current?.abort();};},[]);
  const change=(patch:Partial<PromptDraft>)=>{const next={...draftRef.current,...patch};draftRef.current=next;props.onDraftChange(next);};
  const changeRequest=(value:string)=>{props.onDraftPromptChange(value);change({candidates:[],selectedCandidateIndex:undefined,finalPrompt:undefined,negativePrompt:undefined,manuallyEdited:false,templateId:undefined,previousPrompt:undefined,followUp:undefined});};
  const wasOptimizing=useRef(false), wasBusy=useRef(props.busy);
  useEffect(()=>{if(wasOptimizing.current && !optimizing && document.activeElement===document.body)optimizeTrigger.current?.focus();wasOptimizing.current=optimizing;},[optimizing]);
  useEffect(()=>{if(wasBusy.current && !props.busy && document.activeElement===document.body)generateTrigger.current?.focus();wasBusy.current=props.busy;},[props.busy]);
  const previousAutoMode=useRef(automaticMode);
  useEffect(()=>{if(previousAutoMode.current!==automaticMode && !props.draft.mode)change({candidates:[],selectedCandidateIndex:undefined,templateId:undefined,previousPrompt:undefined,followUp:undefined,...(!props.draft.manuallyEdited ? {finalPrompt:undefined,negativePrompt:undefined} : {})});previousAutoMode.current=automaticMode;},[automaticMode,props.draft.mode]);
  const chooseStyle=(id:string)=>{
    const next=enabledPacks.find(item=>item.id===id) || null;change({stylePackSnapshot:next,...(!props.draft.manuallyEdited ? {finalPrompt:undefined,negativePrompt:undefined} : {})});
    const recommendations=next?.recommendedParams as {aspectRatio?:string;quality?:string;n?:number}|undefined; const touched=props.draft.explicitParams;
    if(!touched?.n)props.onImageCountChange(recommendations?.n || 1);
    if(!touched?.size){const ratio=recommendations?.aspectRatio;const option=props.sizeOptions.find(item=>item.ratio===ratio);props.onSizeChange(option?.value || "");setFormError(ratio && ratio!=="auto" && !option ? t("v2.composer.unsupportedRatio") : "");}
    if(!touched?.quality)props.onQualityChange(isImageQualitySupported(props.imageModel,recommendations?.quality) && props.qualityOptions.some(option=>option.value===recommendations?.quality) ? recommendations!.quality as ImageQuality : "auto");
  };
  const explicit=(key:"size"|"quality"|"n")=>change({explicitParams:{...props.draft.explicitParams,[key]:true}});
  const optimize=async()=>{
    if(optimizing || !props.draftPrompt.trim())return;
    if(mode==="iterate" && (!composed.finalPrompt.trim() || !props.draft.followUp?.trim())){setFormError(t("v2.composer.iterationRequired"));return;}
    const previousPrompt=mode==="iterate" ? composed.finalPrompt : undefined; const followUp=mode==="iterate" ? props.draft.followUp : undefined;
    const request={prompt:props.draftPrompt,mode,language:resolvedLanguage.startsWith("zh") ? "zh" as const : "en" as const,candidates:candidateCount,
      ...(pack ? {stylePackId:pack.id} : {}),previousPrompt,followUp,referenceCount:mode==="t2i" ? 0 : previews.length,
      referenceSummary:mode==="t2i" ? "" : previews.map(preview=>preview.name).join("; ").slice(0,3000),imageCount:props.imageCount};
    controller.current=new AbortController();setOptimizing(true);setOptimizeError("");setFailures([]);setFormError("");
    change({candidates:[],selectedCandidateIndex:undefined,finalPrompt:composed.finalPrompt,negativePrompt:composed.negative,previousPrompt,followUp});
    try {const result=await optimizePrompt(request,controller.current.signal,candidate=>{if(mounted.current)change({candidates:[...(draftRef.current.candidates || []).filter(item=>item.index!==candidate.index),candidate].sort((a,b)=>a.index-b.index)});},failure=>{if(mounted.current)setFailures(current=>[...current.filter(item=>item.index!==failure.index),failure]);},metadata=>{if(mounted.current)change(metadata);});
      if(mounted.current)change({candidates:result.candidates,templateId:result.templateId,stylePackSnapshot:result.stylePackSnapshot});
    }catch(error){if(mounted.current)setOptimizeError(controller.current.signal.aborted ? t("v2.composer.optimizationCancelled") : error instanceof TypeError ? t("v2.composer.networkError") : error instanceof Error ? error.message : t("common.requestFailed"));}
    finally {if(mounted.current)setOptimizing(false);}
  };
  const submit=()=>{
    if(props.busy || optimizing || props.uploadPending)return;
    if(!props.draftPrompt.trim() || !composed.finalPrompt.trim()){setFormError(t("v2.composer.requestRequired"));props.textareaRef.current?.focus();return;}
    if((mode==="i2i" && !previews.length) || (mode==="multi" && previews.length<2)){setFormError(t("v2.composer.referenceRequired"));return;}
    setFormError("");props.onSubmit({originalRequest:props.draftPrompt,optimizeMode:mode,stylePackSnapshot:pack,finalPrompt:composed.finalPrompt,negativePrompt:composed.negative,
      ...(props.draft.selectedCandidateIndex!==undefined ? {selectedCandidateIndex:props.draft.selectedCandidateIndex} : {}),promptCandidates:props.draft.candidates || [],templateId:props.draft.templateId,
      previousPrompt:props.draft.previousPrompt,followUp:props.draft.followUp});
  };
  const upload=async(files:File[])=>{if(props.uploadPending || props.busy || optimizing)return;setFormError("");try{await props.onUpload(files);}catch(error){setFormError(error instanceof Error ? error.message : t("common.requestFailed"));}};
  return <section className="v2-composer" aria-label={t("v2.composer.title")}>
    <form className="v2-stack" onSubmit={event=>{event.preventDefault();submit();}} onDragOver={event=>{if(event.dataTransfer.types.includes("Files"))event.preventDefault();}} onDrop={event=>{if(!event.dataTransfer.files.length)return;event.preventDefault();void upload(Array.from(event.dataTransfer.files));}}>
      <Textarea ref={props.textareaRef} id="v2-original-request" label={t("v2.composer.original")} value={props.draftPrompt} maxLength={30000} placeholder={t("v2.composer.placeholder")} error={formError || undefined} disabled={optimizing || props.busy} onPaste={props.onPaste} onChange={event=>changeRequest(event.target.value)} />
      <div className="v2-row"><Button disabled={props.uploadPending || optimizing || props.busy} onClick={()=>fileRef.current?.click()}><ImagePlus size={18} aria-hidden="true" />{t(props.uploadPending ? "common.loading" : "v2.composer.upload")}</Button><input ref={fileRef} className="visually-hidden" tabIndex={-1} aria-label={t("v2.composer.upload")} type="file" accept="image/*" multiple onChange={event=>{const files=Array.from(event.target.files || []);event.target.value="";void upload(files);}} />
        <Button ref={materialTrigger} disabled={optimizing || props.busy} onClick={()=>setMaterialOpen(true)}>{t("sidebar.assets")}</Button><span className="v2-composer-hint">{t("v2.composer.dropHint")}</span>
      </div>
      {previews.length ? <div className="v2-reference-list">{previews.map((preview,index)=><figure key={preview.id}><Button className="v2-reference-open" disabled={optimizing || props.busy} onClick={()=>preview.onOpen ? preview.onOpen() : setLightbox({items:previews.map(item=>({url:item.previewUrl || item.url,thumbnailUrl:item.url,name:item.name})),index})} aria-label={t("composer.previewNamed",{name:preview.name})}><img src={preview.url} alt={preview.name}/></Button><figcaption>{preview.name}</figcaption><Button variant="ghost" disabled={optimizing || props.busy} aria-label={t("composer.removeNamed",{name:preview.name})} onClick={preview.onRemove}><X size={16} aria-hidden="true" /></Button></figure>)}</div> : null}
      <div className="v2-composer-options"><Select label={t("v2.gallery.mode")} value={props.draft.mode || "auto"} disabled={optimizing || props.busy} onChange={event=>change({mode:event.target.value==="auto" ? undefined : event.target.value as PromptMode,candidates:[],selectedCandidateIndex:undefined,templateId:undefined,previousPrompt:undefined,followUp:undefined})}><option value="auto">{t("v2.composer.autoMode",{mode:t(`v2.mode.${automaticMode}`)})}</option>{(["t2i","i2i","multi","iterate"] as const).map(item=><option key={item} value={item}>{t(`v2.mode.${item}`)}</option>)}</Select>
        <Select label={t("v2.shell.stylePacks")} value={pack?.id || ""} disabled={packs.isLoading || optimizing || props.busy} onChange={event=>chooseStyle(event.target.value)}><option value="">{t("v2.composer.noStyle")}</option>{groups.map(group=><optgroup key={group} label={group}>{enabledPacks.filter(item=>item.groupKey===group).map(item=><option key={item.id} value={item.id}>{item.name}{item.scope==="user" ? ` · ${t("common.mine")}` : ""}</option>)}</optgroup>)}</Select>
        <Select label={t("v2.composer.candidateCount")} value={candidateCount} disabled={optimizing || props.busy} onChange={event=>change({candidateCount:Number(event.target.value)})}>{[1,2,3].map(number=><option key={number}>{number}</option>)}</Select>
      </div>
      {mode==="t2i" && previews.length ? <p className="v2-composer-hint">{t("v2.composer.referencesIgnored")}</p> : null}
      {packs.error ? <ErrorState message={packs.error.message} onRetry={()=>void packs.refetch()} /> : null}
      {pack ? <div className="v2-style-summary"><span>{t("v2.composer.prefix")}: {pack.promptPrefix || t("v2.composer.empty")}</span><span>{t("v2.composer.suffix")}: {pack.promptSuffix || t("v2.composer.empty")}</span><Button variant="ghost" disabled={optimizing || props.busy} onClick={()=>chooseStyle("")}>{t("v2.composer.removeStyle")}</Button></div> : null}
      {mode==="iterate" ? <Textarea label={t("v2.composer.followUp")} value={props.draft.followUp || ""} maxLength={10000} disabled={optimizing || props.busy} onChange={event=>change({followUp:event.target.value})} /> : null}
      <div className="v2-row"><Button ref={optimizeTrigger} disabled={optimizing || props.busy || !props.draftPrompt.trim()} onClick={()=>void optimize()}>{t(optimizing ? "v2.composer.optimizing" : optimizeError ? "v2.composer.retryOptimize" : "v2.composer.optimize")}</Button>{optimizing ? <Button onClick={()=>controller.current?.abort()}>{t("common.cancel")}</Button> : <span className="v2-composer-hint">{t("v2.composer.optional")}</span>}</div>
      {optimizeError ? <ErrorState message={optimizeError} onRetry={()=>void optimize()} /> : null}
      {failures.map(failure=><ErrorState key={failure.index} message={t("v2.composer.candidateError",{index:failure.index+1,error:failure.error})} />)}
      {props.draft.candidates?.length ? <div className="v2-candidate-list">{props.draft.candidates.map(candidate=><article className="v2-candidate" key={candidate.index}><header><strong>{t("v2.composer.candidate",{index:candidate.index+1})}</strong>{candidate.index===props.draft.selectedCandidateIndex ? <Tag>{t("v2.composer.adopted")}</Tag> : null}</header><p>{candidate.finalPrompt}</p><details><summary>{t("v2.composer.structure")}</summary><dl>{Object.entries(candidate.structured).filter(([key,value])=>key!=="finalPrompt" && value).map(([key,value])=><div key={key}><dt>{t(`v2.structured.${key}`)}</dt><dd>{value}</dd></div>)}</dl></details><Button disabled={optimizing || props.busy} onClick={()=>change({selectedCandidateIndex:candidate.index,manuallyEdited:false,finalPrompt:undefined,negativePrompt:undefined})}>{t("v2.composer.adopt")}</Button></article>)}</div> : null}
      <details className="v2-final-panel" open={Boolean(props.draft.candidates?.length || props.draft.manuallyEdited)}><summary>{t("v2.composer.final")}{props.draft.manuallyEdited ? <Tag>{t("v2.composer.manual")}</Tag> : null}</summary><div className="v2-stack"><Textarea label={t("v2.composer.positive")} value={composed.finalPrompt} maxLength={30000} disabled={optimizing || props.busy} onChange={event=>change({manuallyEdited:true,finalPrompt:event.target.value,negativePrompt:composed.negative})} /><Textarea label={t("v2.composer.negative")} value={composed.negative} maxLength={10000} disabled={optimizing || props.busy} onChange={event=>change({manuallyEdited:true,finalPrompt:composed.finalPrompt,negativePrompt:event.target.value})}/></div></details>
      <div className="v2-composer-options"><Select label={t("v2.composer.model")} value={props.imageModels.includes(props.imageModel) ? props.imageModel : ""} disabled={!props.imageModels.length || optimizing || props.busy} onChange={event=>props.onImageModelChange(event.target.value)}>{!props.imageModels.length ? <option value="">{t("v2.composer.unconfigured")}</option> : props.imageModels.map(model=><option value={model} key={model}>{imageModelDisplayName(model)}</option>)}</Select>
        {props.sizeOptions.length ? <Select label={t("v2.composer.ratio")} value={props.size} disabled={optimizing || props.busy} onChange={event=>{explicit("size");props.onSizeChange(event.target.value);setFormError("");}}><option value="">{t("v2.composer.providerDefault")}</option>{props.sizeOptions.map(option=><option value={option.value} key={option.value}>{option.ratio}</option>)}</Select> : null}
        {props.qualityOptions.length ? <Select label={t("v2.composer.quality")} value={props.quality} disabled={optimizing || props.busy} onChange={event=>{explicit("quality");props.onQualityChange(event.target.value as ImageQuality);}}><option value="auto">{t("v2.composer.providerDefault")}</option>{props.qualityOptions.map(option=><option value={option.value} key={option.value}>{option.labelKey ? t(option.labelKey) : option.label}</option>)}</Select> : null}
        <Input type="number" label={t("v2.composer.count")} min={1} max={10} value={props.imageCount} disabled={optimizing || props.busy} onChange={event=>{const n=event.currentTarget.valueAsNumber;if(Number.isInteger(n) && n>=1 && n<=10){explicit("n");props.onImageCountChange(n);}}}/>
      </div>
      {props.error ? <ErrorState message={props.error === "Failed to fetch" ? t("v2.composer.networkError") : props.error} onRetry={submit} /> : null}
      <div className="v2-composer-submit">{props.busy ? <><span role="status">{t("v2.composer.generating")}</span>{props.onCancel ? <Button disabled={props.cancelPending} onClick={props.onCancel}>{t(props.cancelPending ? "composer.cancelling" : "composer.cancelGeneration")}</Button> : null}</> : <Button ref={generateTrigger} variant="primary" type="submit" disabled={optimizing || props.uploadPending || !props.draftPrompt.trim()}>{t("v2.composer.generate")}</Button>}</div>
    </form>
    <Dialog returnFocus={materialTrigger} open={materialOpen} onOpenChange={setMaterialOpen} title={t("sidebar.assets")}><MaterialPicker selectedAssets={props.selectedAssets} onToggleAsset={props.onToggleAsset} onSelectedAssetsChange={props.onSelectedAssetsChange} />{!props.selectedAssets.length ? <EmptyState title={t("v2.composer.selectReference")} /> : null}</Dialog>
    <ImageLightbox state={lightbox} onClose={()=>setLightbox(null)} onChangeIndex={index=>setLightbox(current=>current ? {...current,index} : null)} />
  </section>;
}
