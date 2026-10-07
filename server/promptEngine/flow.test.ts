import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

test("legacy/new optimizer, partial candidates/SSE and generate/edit persist immutable prompt snapshots", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "shenbi-prompt-flow-"));
  try {
    const url = (name: string) => JSON.stringify(new URL(name, import.meta.url).href);
    const program = `
      import assert from 'node:assert/strict';
      import {Hono} from 'hono';
      import sharp from 'sharp';
      import {appDb,configDb} from ${url("../db.ts")};
      import {initAppDb,initConfigDb} from ${url("../schema.ts")};
      import {registerPromptTemplateRoutes} from ${url("../promptTemplateRoutes.ts")};
      import {registerImageRoutes} from ${url("../imageRoutes.ts")};
      import {publicStylePack,visibleStylePack} from ${url("../stylePacks.ts")};
      initAppDb();initConfigDb();
      const stamp=new Date().toISOString();const session=crypto.randomUUID();
      appDb.query('insert into users(id,account,username,password_hash,created_at,updated_at) values(?,?,?,?,?,?)').run('A','test-A','test-A','test-only',stamp,stamp);
      // This flow tests prompt snapshots, not tier limits: give the user the unrestricted tier.
      appDb.query("update users set tier_id = 'pro' where id = 'A'").run();
      appDb.query('insert into user_auth_sessions values(?,?,?,?)').run(session,'A',new Date(Date.now()+60000).toISOString(),stamp);
      appDb.query('insert into user_preferences(user_id,prompt_optimize_custom_instruction,updated_at) values(?,?,?)').run('A','Preserve original labels',stamp);
      const image=await sharp({create:{width:8,height:8,channels:3,background:'#eeeeee'}}).png().toBuffer();
      const modelCalls=[];const imageCalls=[];
      let failAll=false;
      const supplier=Bun.serve({hostname:'127.0.0.1',port:0,fetch:async req=>{
        if(new URL(req.url).pathname.startsWith('/images/')) {
          const contentType=req.headers.get('content-type')||'';
          const body=contentType.includes('multipart/form-data')?Object.fromEntries(await req.formData()):await req.json();
          imageCalls.push(body);return Response.json({data:[{b64_json:image.toString('base64')}]});
        }
        const body=await req.json();modelCalls.push(body);
        const structured=body.messages[0].content.includes('finalPrompt');
        if(failAll||body.messages[1].content.includes('Candidate: 2'))return Response.json({error:{message:'Unit-test candidate failure'}},{status:500});
        const content=structured?JSON.stringify({subject:'Bottle',scene:'Desk',composition:'Centered',camera:'Front',lighting:'Soft',style:'Product',material:'Glass',text:'ShenBi',constraints:'One',negative:'blur',finalPrompt:'One glass bottle labeled ShenBi'}):'An improved glass bottle photograph\\n---NEGATIVE PROMPT---\\nblur';
        if(body.stream) {
          const half=Math.floor(content.length/2);
          const frames=[content.slice(0,half),content.slice(half)].map(chunk=>'data: '+JSON.stringify({choices:[{delta:{content:chunk}}]})+'\\n\\n').join('')+'data: [DONE]\\n\\n';
          return new Response(frames,{headers:{'content-type':'text/event-stream'}});
        }
        return Response.json({choices:[{message:{content}}]});
      }});
      configDb.exec('delete from prompt_optimizer_providers');
      configDb.query('insert into prompt_optimizer_providers(id,name,enabled,base_url,api_key_env,api_key_value,model,retry_count,created_at,updated_at) values(?,?,?,?,?,?,?,?,?,?)').run('text-test','Test text',1,supplier.url.origin,'','unit-test-token','test-text-model',0,stamp,stamp);
      configDb.query('insert or replace into language_model_assignments values(?,?,?,?)').run('prompt.optimize','text-test','assigned-text-model',stamp);
      appDb.query("update style_packs set prompt_prefix='STUDIO',prompt_suffix='TAIL',negative_prompt='watermark',recommended_params_json=? where id=?").run(JSON.stringify({n:2,quality:'high',aspectRatio:'3:4'}),'system:realistic:commercial-product');
      const snapshot=publicStylePack(visibleStylePack(appDb,'A','system:realistic:commercial-product'));
      const app=new Hono();registerPromptTemplateRoutes(app);registerImageRoutes(app);
      const request=(route,body)=>app.request(route,{method:'POST',headers:{'content-type':'application/json',cookie:'app_session='+session},body:JSON.stringify(body)});
      const old=await request('/prompt-optimizer/optimize',{prompt:'One bottle',optimizeStyle:'standard'});assert.equal(old.status,200);
      const legacy=await old.json();assert.equal(legacy.prompt,'An improved glass bottle photograph');assert.equal(legacy.negativePrompt,'blur');assert.equal(legacy.model,'assigned-text-model');assert.equal(legacy.candidates,undefined);
      const optimized=await request('/prompt-optimizer/optimize',{prompt:'One bottle labeled ShenBi',mode:'t2i',language:'en',candidates:3,stylePackId:snapshot.id});assert.equal(optimized.status,200);
      const result=await optimized.json();assert.equal(result.candidates.length,2);assert.equal(result.errors.length,1);assert.deepEqual(result.candidates.map(c=>c.index),[0,2]);
      assert.equal(result.candidates[0].structured.subject,'Bottle');assert.equal(result.candidates[0].finalPrompt,'STUDIO\\nOne glass bottle labeled ShenBi\\nTAIL');assert.equal(result.candidates[0].negative,'blur, watermark');assert.equal(result.stylePackSnapshot.id,snapshot.id);
      assert(modelCalls.at(-1).messages[1].content.includes('Preserve original labels'));assert.equal(modelCalls.at(-1).model,'assigned-text-model');
      assert.equal((await request('/prompt-optimizer/optimize',{prompt:'test',mode:'iterate'})).status,400);
      assert.equal((await request('/prompt-optimizer/optimize',{prompt:'test',mode:'i2i',templateId:'text2image/general-image-optimize:en',language:'en'})).status,400);
      assert.equal((await request('/prompt-optimizer/optimize',{prompt:'test',mode:'t2i',candidates:4})).status,400);
      const iterated=await request('/prompt-optimizer/optimize',{prompt:'Original request',mode:'iterate',previousPrompt:'Earlier full prompt',followUp:'Change only background',language:'en'});assert.equal(iterated.status,200);
      assert(modelCalls.at(-1).messages[1].content.includes('Earlier full prompt'));assert(modelCalls.at(-1).messages[1].content.includes('Change only background'));
      failAll=true;assert.equal((await request('/prompt-optimizer/optimize',{prompt:'test',mode:'t2i'})).status,502);failAll=false;
      const canceled=new AbortController();canceled.abort();const beforeCancel=modelCalls.length;
      const cancelResponse=await app.request('/prompt-optimizer/optimize',{method:'POST',signal:canceled.signal,headers:{'content-type':'application/json',cookie:'app_session='+session},body:JSON.stringify({prompt:'test',mode:'t2i'})});assert.equal(cancelResponse.status,502);assert.equal(modelCalls.length,beforeCancel);
      configDb.exec("update prompt_optimizer_providers set stream_enabled=1 where id='text-test'");
      const streamed=await request('/prompt-optimizer/optimize',{prompt:'Bottle',mode:'t2i',candidates:3,language:'en'});assert(streamed.headers.get('content-type').includes('text/event-stream'));
      const frames=await streamed.text();assert(frames.includes('event: candidate\\n'));assert(frames.includes('event: candidate-error\\n'));assert(frames.includes('event: done\\n'));assert(frames.includes('event: delta\\n'));
      const oldStream=await request('/prompt-optimizer/optimize',{prompt:'Bottle'});assert((await oldStream.text()).includes('event: done\\n'));
      configDb.exec('update prompt_optimizer_providers set enabled=0;delete from provider_configs');
      configDb.query('insert into provider_configs(id,name,type,channel,enabled,base_url,api_key_env,api_key_value,route_mode,generation_path,edit_path,model,sizes,qualities,default_size,default_quality,response_image_path,created_at,updated_at) values(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run('image-test','Test image','openai-compatible','api',1,supplier.url.origin,'','','images_api','/images/generations','/images/edits','custom-image-model','["1024x1024","1536x2048"]','["low","high"]','1024x1024','high','data[0].b64_json',stamp,stamp);
      configDb.exec("update image_generation_settings set mode='api',result_retry_count=0");
      const plan={providerId:'image-test',originalRequest:'One branded bottle',optimizeMode:'t2i',stylePackSnapshot:snapshot,selectedCandidateIndex:2,promptCandidates:result.candidates,templateId:result.templateId,finalPrompt:'Manual exact prompt',negativePrompt:'no blur',n:1,size:'auto',quality:'low'};
      const generated=await request('/images/generate',{...plan,prompt:'Ignored legacy field'});assert.equal(generated.status,202);
      const generation=await generated.json();
      const waitJob=async id=>{for(let i=0;i<100;i++){const row=appDb.query('select status,error from image_jobs where id=?').get(id);if(row.status!=='running'){assert.equal(row.status,'succeeded',row.error);await Bun.sleep(10);return;}await Bun.sleep(20);}throw new Error('job did not settle');};
      await waitJob(generation.job.id);
      const metadataFor=id=>JSON.parse(appDb.query("select metadata from messages where role='user' and json_extract(metadata,'$.jobId')=?").get(id).metadata);
      const saved=metadataFor(generation.job.id);assert.equal(saved.originalRequest,plan.originalRequest);assert.equal(saved.selectedCandidateIndex,2);assert.equal(saved.finalPrompt,'Manual exact prompt');assert.equal(saved.negativePrompt,'no blur');assert.deepEqual(saved.stylePackSnapshot,snapshot);assert.deepEqual(saved.promptCandidates,result.candidates);assert.equal(saved.templateId,result.templateId);
      assert(imageCalls[0].prompt.startsWith('Manual exact prompt'));assert(!imageCalls[0].prompt.includes('STUDIO'));assert(imageCalls[0].prompt.includes('no blur'));assert.equal(imageCalls[0].quality,'low');assert.equal(imageCalls[0].size,'auto');
      appDb.query("update style_packs set name='Changed later',prompt_prefix='New prefix' where id=?").run(snapshot.id);assert.deepEqual(metadataFor(generation.job.id).stylePackSnapshot,snapshot);
      const edited=await request('/images/edit',{...plan,optimizeMode:'i2i',sourceInlineImages:[{fileName:'unit-only.png',mimeType:'image/png',dataUrl:'data:image/png;base64,'+image.toString('base64')}]});assert.equal(edited.status,202);
      const edit=await edited.json();await waitJob(edit.job.id);const editedMetadata=metadataFor(edit.job.id);assert.deepEqual(editedMetadata.stylePackSnapshot,snapshot);assert.equal(editedMetadata.finalPrompt,'Manual exact prompt');assert(editedMetadata.sourceReferenceImages.length===1);
      assert.equal((await request('/images/generate',{...plan,selectedCandidateIndex:3})).status,400);
      const oldImage=await request('/images/generate',{prompt:'Old client prompt',providerId:'image-test',n:1});assert.equal(oldImage.status,202);const oldJob=await oldImage.json();await waitJob(oldJob.job.id);assert.equal(metadataFor(oldJob.job.id).originalRequest,undefined);assert.equal(metadataFor(oldJob.job.id).stylePackSnapshot,undefined);
      supplier.stop(true);appDb.close();configDb.close();console.log('prompt-flow-ok');
    `;
    const child=Bun.spawn([process.execPath,"--eval",program],{env:{...Bun.env,GPT_IMAGE_DATA_DIR:directory,GPT_IMAGE_APP_DB_PATH:path.join(directory,"app.db"),GPT_IMAGE_CONFIG_DB_PATH:path.join(directory,"config.db")},stdout:"pipe",stderr:"pipe"});
    const [stdout,stderr,code]=await Promise.all([new Response(child.stdout).text(),new Response(child.stderr).text(),child.exited]);
    expect(stderr).toBe("");expect(code).toBe(0);expect(stdout.trim().split("\n").at(-1)).toBe("prompt-flow-ok");
  } finally {await rm(directory,{recursive:true,force:true});}
},15000);
