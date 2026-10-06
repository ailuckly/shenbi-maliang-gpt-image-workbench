import { Database } from "bun:sqlite";
import { expect, test } from "bun:test";
import { cloneDefaultPromptOptimizeStyleGroups, promptOptimizeStyleOptions } from "../src/lib/promptOptimizeStyles";
import { migrateStylePacks, visibleStylePack, visibleStylePacks } from "./stylePacks";

function database() {
  const db = new Database(":memory:");
  db.exec(`pragma foreign_keys = on;
    create table users(id text primary key);
    insert into users values ('A'), ('B');
    create table app_migrations(id text primary key, created_at text not null);
    create table user_preferences(user_id text primary key, prompt_optimize_styles_json text not null,
      prompt_optimize_custom_instruction text not null default '', updated_at text not null);`);
  return db;
}

test("empty style table seeds every group and child once without overwriting admin changes", () => {
  const db = database();
  try {
    migrateStylePacks(db, "first");
    expect(visibleStylePacks(db, "A")).toHaveLength(promptOptimizeStyleOptions.length);
    const product = visibleStylePack(db, "A", "system:realistic:commercial-product")!;
    expect(product.optimize_instruction).toContain("使用写实风格");
    expect(product.optimize_instruction).toContain("商业产品摄影");
    expect(product.prompt_prefix).toBe("commercial product photography");
    db.query("update style_packs set name = 'Edited', enabled = 0 where id = ?").run(product.id);
    migrateStylePacks(db, "second");
    expect(visibleStylePack(db, "A", product.id)).toBeNull();
    expect(db.query("select name, created_at from style_packs where id = ?").get(product.id)).toEqual({name:"Edited", created_at:"first"});
    expect(() => db.exec("insert into style_packs(id,scope,group_key,name,created_at,updated_at) values('bad','user','test','bad','a','a')")).toThrow();
  } finally { db.close(); }
});

test("legacy customizations migrate once, preserve preferences and remain private to their owner", () => {
  const db = database();
  try {
    const groups = cloneDefaultPromptOptimizeStyleGroups();
    groups.push({value:"custom:brand",label:"私人品牌",description:"用于指定品牌",prompt:"必须保留 ShenBi 名称",children:[{value:"custom:brand:hidden",label:"隐藏子风格",description:"备用",prompt:"保持指定字体",visible:false}]});
    groups[1].prompt = "只使用蓝色";
    db.query("insert into user_preferences values (?, ?, ?, ?)").run("A",JSON.stringify(groups),"用户独立补充指令","first");
    db.query("insert into user_preferences values (?, ?, ?, ?)").run("B",JSON.stringify([{value:"custom:brand",label:"B 私有",description:"私有",prompt:"绿色"}]),"","first");
    const invalid = JSON.stringify(groups);
    migrateStylePacks(db, "first");
    const a = visibleStylePacks(db, "A").filter(pack => pack.scope === "user");
    const b = visibleStylePacks(db, "B").filter(pack => pack.scope === "user");
    expect(b).toHaveLength(1);
    expect(a.find(pack => pack.name === "私人品牌")!.optimize_instruction).toBe("必须保留 ShenBi 名称");
    expect(a.find(pack => pack.name === "隐藏子风格")!.enabled).toBe(0);
    expect(a.find(pack => pack.name === "人像摄影")!.optimize_instruction).toContain("只使用蓝色");
    expect(visibleStylePack(db,"B",a[0].id)).toBeNull();
    expect(visibleStylePack(db,"A",b[0].id)).toBeNull();
    expect(db.query("select prompt_optimize_styles_json as styles, prompt_optimize_custom_instruction as instruction from user_preferences where user_id = 'A'").get()).toEqual({styles:invalid,instruction:"用户独立补充指令"});
    db.query("delete from style_packs where id = ?").run(a[0].id);
    migrateStylePacks(db,"second");
    expect(visibleStylePack(db,"A",a[0].id)).toBeNull();
    expect(visibleStylePacks(db,"A").filter(pack => pack.scope === "user")).toHaveLength(a.length - 1);
    db.exec("delete from users where id = 'B'");
    expect(visibleStylePacks(db,"B").filter(pack => pack.scope === "user")).toHaveLength(0);
  } finally { db.close(); }
});

test("broken legacy JSON is retained and does not stop seeding", () => {
  const db = database();
  try {
    db.query("insert into user_preferences values ('A', ?, '', 'first')").run("{broken");
    migrateStylePacks(db);
    expect(visibleStylePacks(db,"A")).toHaveLength(promptOptimizeStyleOptions.length);
    expect(db.query("select prompt_optimize_styles_json as value from user_preferences").get()).toEqual({value:"{broken"});
  } finally { db.close(); }
});
