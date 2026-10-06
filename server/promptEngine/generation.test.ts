import { expect, test } from "bun:test";
import { Database } from "bun:sqlite";
import { applyPromptRecommendations, preparePromptGeneration } from "./generation";
import { migrateStylePacks, publicStylePack, visibleStylePack } from "../stylePacks";
import type { RuntimeProviderRow } from "../types";

test("generation composition keeps manual final text, validates snapshots and applies only missing parameters", () => {
  const db = new Database(":memory:");
  try {
    db.exec("create table users(id text primary key);create table app_migrations(id text primary key,created_at text);create table user_preferences(user_id text,prompt_optimize_styles_json text)");
    migrateStylePacks(db);
    const snapshot = {...publicStylePack(visibleStylePack(db,"A","system:realistic:commercial-product")!),
      promptPrefix:"Studio light",promptSuffix:"Soft light",negativePrompt:"blur",recommendedParams:{aspectRatio:"3:4",n:2,quality:"high"}};
    const old = {prompt:"Old prompt",n:1};
    expect(preparePromptGeneration(old,"A",db)).toEqual({error:"",body:old,metadata:{}});
    expect(preparePromptGeneration({prompt:"User body",stylePackSnapshot:snapshot},"A",db).body.prompt).toContain("Studio light\nUser body\nSoft light");
    const manual = preparePromptGeneration({prompt:"Ignored",finalPrompt:"Exact  manual\ntext",negativePrompt:"No duplicates",stylePackSnapshot:snapshot,originalRequest:"Original",optimizeMode:"t2i",selectedCandidateIndex:2},"A",db);
    expect(manual.metadata.finalPrompt).toBe("Exact  manual\ntext");
    expect(manual.body.prompt).not.toContain("Studio light");
    expect(manual.body.prompt).toContain("No duplicates");
    expect(preparePromptGeneration({finalPrompt:"test",selectedCandidateIndex:3},"A",db).error).not.toBe("");
    expect(preparePromptGeneration({stylePackSnapshot:{...snapshot,apiKey:"not allowed"}},"A",db).error).not.toBe("");
    const provider = {sizes:'["1024x1024","1536x2048"]',default_size:"1024x1024",default_quality:"low"} as RuntimeProviderRow;
    expect(applyPromptRecommendations({originalRequest:"test",stylePackSnapshot:snapshot},provider).body).toMatchObject({size:"1536x2048",quality:"high",n:2});
    expect(applyPromptRecommendations({originalRequest:"test",stylePackSnapshot:snapshot,size:"auto",quality:"low",n:1},provider).body).toMatchObject({size:"auto",quality:"low",n:1});
    expect(applyPromptRecommendations(old,provider)).toEqual({error:"",body:old});
    expect(applyPromptRecommendations({originalRequest:"test",stylePackSnapshot:{...snapshot,recommendedParams:{aspectRatio:"7:3"}}},provider).error).not.toBe("");
    const saved = JSON.stringify(manual.metadata);
    db.query("update style_packs set name = 'Changed',prompt_prefix='New' where id = ?").run(snapshot.id);
    expect(JSON.parse(saved).stylePackSnapshot.name).toBe(snapshot.name);
    db.query("update style_packs set enabled=0 where id = ?").run(snapshot.id);
    expect(preparePromptGeneration({stylePackSnapshot:snapshot},"A",db).error).not.toBe("");
  } finally { db.close(); }
});
