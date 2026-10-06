import fs from "node:fs/promises";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import assert from "node:assert/strict";
import ts from "typescript";

// Run from the repository root. Scan project files, never runtime data or credentials.
const excluded = /^(?:node_modules|data|runtime|dist|output|tmp|logs|backups|release|release-bin|repo-src-full)\//;
const generated = "docs/project/generated/";
const files = [...new Set(execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], { encoding: "utf8" }).split("\0").filter(Boolean))]
  .filter((file) => !excluded.test(file) && !file.startsWith(generated) && !/(?:^|\/)\.env(?:\.|$)/.test(file))
  .sort();
const textExtensions = new Set([".ts", ".tsx", ".js", ".mjs", ".css", ".py", ".ps1", ".sh", ".bat", ".cmd", ".json", ".yaml", ".yml", ".toml", ".html", ".md", ".txt", ".lock", ".svg"]);
const codeExtensions = new Set([".ts", ".tsx", ".js", ".mjs", ".css", ".py", ".ps1", ".sh", ".bat", ".cmd", ".html"]);
const records = [];
const routes = [];
const pages = [];
const tables = [];
const environment = new Map();
const parseDiagnostics = [];

for (const file of files) {
  let buffer;
  try { buffer = await fs.readFile(file); } catch (error) {
    if (error.code === "ENOENT") continue;
    throw error;
  }
  const extension = path.extname(file).toLowerCase();
  const isText = textExtensions.has(extension) || ["LICENSE", ".gitignore"].includes(path.basename(file));
  const record = {
    path: file, bytes: buffer.length, sha256: createHash("sha256").update(buffer).digest("hex"),
    category: /(?:\.test\.|\/tests\/|test_)/.test(file) ? "test" : codeExtensions.has(extension) ? "code" : isText ? "text" : "binary",
    imports: [], exports: [], symbols: []
  };
  records.push(record);
  if (!isText) continue;
  const text = buffer.toString("utf8");
  record.lines = text.split("\n").length;
  for (const match of text.matchAll(/(?:Bun|process)\.env(?:\.([A-Za-z_][A-Za-z0-9_]*)(?![A-Za-z0-9_$])|\[['"]([A-Za-z_][A-Za-z0-9_]*)['"]\])|os\.(?:environ\.get|getenv)\(['"]([A-Za-z_][A-Za-z0-9_]*)['"]/g)) {
    const name = match[1] || match[2] || match[3];
    const items = environment.get(name) || [];
    items.push({ file, line: text.slice(0, match.index).split("\n").length });
    environment.set(name, items);
  }
  if (extension === ".py") {
    for (const match of text.matchAll(/^\s*(?:async\s+)?(?:def|class)\s+(\w+)/gm)) record.symbols.push({ name: match[1], line: text.slice(0, match.index).split("\n").length });
  }
  if (![".ts", ".tsx", ".js", ".mjs"].includes(extension)) continue;
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, extension === ".tsx" ? ts.ScriptKind.TSX : extension === ".ts" ? ts.ScriptKind.TS : ts.ScriptKind.JS);
  const line = (node) => source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
  const literal = (node) => node && (ts.isStringLiteralLike(node) || ts.isNoSubstitutionTemplateLiteral(node)) ? node.text : null;
  for (const diagnostic of source.parseDiagnostics) parseDiagnostics.push({ file, line: source.getLineAndCharacterOfPosition(diagnostic.start || 0).line + 1, message: ts.flattenDiagnosticMessageText(diagnostic.messageText, " ") });
  function visit(node) {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
      const specifier = literal(node.moduleSpecifier);
      if (specifier) record.imports.push({ module: specifier, line: line(node), typeOnly: Boolean(node.importClause?.isTypeOnly || node.isTypeOnly) });
    }
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      const specifier = literal(node.arguments[0]);
      if (specifier) record.imports.push({ module: specifier, line: line(node), dynamic: true });
    }
    if ((ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node) || ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node)) && node.name) {
      const item = { name: node.name.text, line: line(node), kind: ts.SyntaxKind[node.kind] };
      record.symbols.push(item);
      if (node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)) record.exports.push(item);
    }
    if (ts.isVariableStatement(node) && node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)) {
      for (const declaration of node.declarationList.declarations) record.exports.push({ name: declaration.name.getText(source), line: line(declaration), kind: "variable" });
    }
    if ((ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) && node.tagName.getText(source) === "Route") {
      const attr = node.attributes.properties.find((item) => ts.isJsxAttribute(item) && item.name.getText(source) === "path");
      if (attr?.initializer && ts.isStringLiteral(attr.initializer)) pages.push({ path: attr.initializer.text, file, line: line(node) });
    }
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      const method = node.expression.name.text.toLowerCase();
      const route = literal(node.arguments[0]);
      if (file.startsWith("server/") && record.category !== "test" && ["get", "post", "put", "patch", "delete", "all", "use", "route"].includes(method) && route?.startsWith("/")) {
        const body = node.arguments.slice(1).map((arg) => arg.getText(source)).join("\n");
        routes.push({ method: method.toUpperCase(), declaredPath: route, receiver: node.expression.expression.getText(source), file, line: line(node), authHints: ["requireConfig", "requireUser", "requireImageRouteUser", "currentUser", "resolveMcpAccessToken"].filter((name) => body.includes(name)) });
      }
    }
    if (ts.isStringLiteralLike(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isTemplateExpression(node)) {
      const value = ts.isTemplateExpression(node) ? node.getText(source).slice(1, -1) : node.text;
      for (const match of value.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?([\w]+)\s*\(/gi)) {
        let start = match.index + match[0].length;
        let depth = 1;
        let end = start;
        for (; end < value.length && depth; end++) {
          if (value[end] === "(") depth++;
          if (value[end] === ")") depth--;
        }
        const body = value.slice(start, end - 1);
        const columns = body.split("\n").map((part) => part.trim().match(/^([a-z_][a-z0-9_]*)\s+(text|integer|real|blob|numeric)\b/i)).filter(Boolean).map((item) => ({ name: item[1], type: item[2].toLowerCase() }));
        let context = node.parent;
        let database = "unknown";
        while (context) {
          if (ts.isCallExpression(context) && context.arguments[0]) {
            const candidate = context.arguments[0].getText(source);
            if (["appDb", "configDb"].includes(candidate)) { database = candidate; break; }
          }
          if (ts.isFunctionDeclaration(context) && context.name?.text === "initAppDb") { database = "appDb"; break; }
          if (ts.isFunctionDeclaration(context) && context.name?.text === "initConfigDb") { database = "configDb"; break; }
          context = context.parent;
        }
        tables.push({ name: match[1], database, file, line: line(node) + value.slice(0, match.index).split("\n").length - 1, columns });
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
}

assert(records.some((record) => record.path === "server/index.ts"));
assert(routes.some((route) => route.declaredPath === "/health"));
assert(tables.some((table) => table.name === "image_jobs"));
const git = (args) => execFileSync("git", args, { encoding: "utf8" }).trim();
const summary = {
  scope: "Git tracked and non-ignored project files; excludes runtime data, credentials, dependencies, build output and generated inventory.",
  capturedAt: new Date().toISOString(), branch: git(["branch", "--show-current"]), head: git(["rev-parse", "HEAD"]),
  files: records.length, textFiles: records.filter((record) => record.lines != null).length,
  codeFiles: records.filter((record) => record.category === "code").length,
  testFiles: records.filter((record) => record.category === "test").length,
  codeLines: records.filter((record) => ["code", "test"].includes(record.category)).reduce((sum, record) => sum + (record.lines || 0), 0),
  routeDeclarations: routes.length, reactRouteDeclarations: pages.length,
  sqlTableDeclarations: tables.length, environmentNames: environment.size, parseDiagnostics: parseDiagnostics.length
};
await fs.mkdir(generated, { recursive: true });
await fs.writeFile(path.join(generated, "inventory.json"), JSON.stringify({ summary, files: records, routes, pages, tables, environment: Object.fromEntries([...environment].sort()), parseDiagnostics }, null, 2) + "\n");
const sourceLink = (file, line) => `[${file}${line ? `:${line}` : ""}](../../../${file}${line ? `#L${line}` : ""})`;
const endpoints = routes.filter((route) => !["USE", "ROUTE"].includes(route.method));
await fs.writeFile(path.join(generated, "api-index.md"), [
  "# API 与页面索引", "", `生成时间：${summary.capturedAt}。来源为静态字面量声明，共 ${routes.length} 条路由声明，其中 ${endpoints.length} 条 HTTP 处理器声明；重复路径、ALL、通配路径不能直接视为独立业务接口数量。`, "",
  "api 接收器按 server/index.ts 的挂载补 /api 前缀；app 接收器为根路径。鉴权提示仅检索处理器文本，未发现提示不代表公开接口，完整权限仍须检查辅助函数与中间件。动态生成的路径不在本索引内。", "",
  "| 方法 | 实际路径 | 鉴权文本提示 | 来源 |", "| --- | --- | --- | --- |",
  ...routes.map((route) => `| ${route.method} | \`${route.receiver === "api" ? "/api" : ""}${route.declaredPath}\` | ${route.authHints.join(", ") || "需追踪辅助函数/中间件"} | ${sourceLink(route.file, route.line)} |`), "",
  "## React 页面声明", "", "| 路径 | 来源 |", "| --- | --- |",
  ...pages.map((page) => `| \`${page.path}\` | ${sourceLink(page.file, page.line)} |`), "",
  "## 环境变量引用", "", "仅记录直接引用的变量名；动态读取的 provider.api_key_env 等不在此列表，不记录任何值。", "",
  "| 变量名 | 引用位置 |", "| --- | --- |",
  ...[...environment].sort().map(([name, refs]) => `| \`${name}\` | ${refs.map((ref) => sourceLink(ref.file, ref.line)).join("、")} |`), ""
].join("\n"));
await fs.writeFile(path.join(generated, "file-index.md"), [
  "# 全仓文件索引", "", `生成时间：${summary.capturedAt}。项目文件 ${summary.files}，代码文件 ${summary.codeFiles}，测试文件 ${summary.testFiles}，代码与测试共 ${summary.codeLines} 行。行数包含空行与 CSS。`, "",
  "扫描全部受 Git 管理及未忽略的项目文件；排除依赖、运行数据、密钥文件、构建产物和本目录。二进制记录大小及哈希；文本记录行数；TS/JS 额外记录 imports/exports/symbols，Python 记录函数/类名。详细结果与 SHA-256 见 inventory.json。自动扫描覆盖不等同于逐行人工审计或全量安全审计。", "",
  "| 文件 | 类别 | 行数 | 字节 | import / export |", "| --- | --- | ---: | ---: | --- |",
  ...records.map((record) => `| ${sourceLink(record.path)} | ${record.category} | ${record.lines ?? "—"} | ${record.bytes} | ${record.imports.length} / ${record.exports.length} |`), ""
].join("\n"));
const schemaPath = path.join(generated, "runtime-schema.json");
try {
  const snapshot = JSON.parse(await fs.readFile(schemaPath, "utf8"));
  const lines = ["# 本地数据库结构快照", "", `快照日期：${snapshot.snapshotDate}。这是只读结构快照，不包含数据行、密码、令牌或密钥值。JSON 内的聚合计数仅代表快照时的本地预览环境。字段职责见 [数据库说明](../../database-schema.md)。`, ""];
  for (const [database, detail] of Object.entries(snapshot.databases)) {
    lines.push(`## ${database}.db · ${detail.tables.length} 张表`, "");
    for (const table of detail.tables) {
      lines.push(`### ${table.name}`, "", "| 字段 | 类型 | NOT NULL 声明 | 主键 |", "| --- | --- | --- | --- |",
        ...table.columns.map((column) => `| \`${column.name}\` | ${column.type || "未声明"} | ${column.notNull ? "是" : "否"} | ${column.primaryKey ? "是" : "否"} |`), "",
        `索引：${table.indexes.map((index) => `${index.name}${index.unique ? "（唯一）" : ""}`).join("、") || "无"}。`, "",
        `外键声明：${table.foreignKeys.map((key) => `${key.sourceColumn} → ${key.targetTable}.${key.targetColumn}`).join("；") || "无"}。`, "");
    }
  }
  await fs.writeFile(path.join(generated, "runtime-schema.md"), lines.join("\n"));
} catch (error) { if (error.code !== "ENOENT") throw error; }
console.log(JSON.stringify(summary, null, 2));
