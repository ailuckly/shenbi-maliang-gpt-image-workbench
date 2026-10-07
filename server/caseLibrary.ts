import { mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { appDb, getAll, getOne, run } from "./db";
import { FILES_DIR } from "./paths";
import { IMAGE_CATEGORIES } from "./promptEngine/imageCategories";
import { now } from "./utils";

// Community prompt cases from freestylefly/awesome-gpt-image-2 (data/cases.json). They are
// synced into the local database on demand and never committed; see README for the source.
const REPOSITORY_RAW = "https://raw.githubusercontent.com/freestylefly/awesome-gpt-image-2/main";
export const CASE_LIBRARY_DIR = path.join(FILES_DIR, "case-library");
export const CASE_LIBRARY_ID_PREFIX = "library-";
const CASE_IMAGE_MAX_SIZE = 1280;
const DOWNLOAD_CONCURRENCY = 6;
// Below this relevance a reference case is more likely to mislead than help.
const MIN_REFERENCE_SCORE = 2;

const SOURCE_CATEGORY_TO_IMAGE_CATEGORY: Record<string, string> = {
  "UI & Interfaces": "ui",
  "Charts & Infographics": "infographic",
  "Posters & Typography": "poster",
  "Products & E-commerce": "product",
  "Brand & Logos": "brand",
  "Architecture & Spaces": "architecture",
  "Photography & Realism": "photo",
  "Illustration & Art": "illustration",
  "Characters & People": "character",
  "Scenes & Storytelling": "scene",
  "History & Classical Themes": "history",
  "Documents & Publishing": "document",
  "Other Use Cases": "general"
};

type SourceCase = { id: number; title: string; image: string; prompt: string; category: string };

export type CaseLibraryStatus = {
  running: boolean;
  total: number;
  processed: number;
  failed: number;
  error: string;
  startedAt: string;
  finishedAt: string;
};

const status: CaseLibraryStatus = { running: false, total: 0, processed: 0, failed: 0, error: "", startedAt: "", finishedAt: "" };

export function caseLibraryCategoryId(imageCategoryId: string) {
  return `casecat_library_${imageCategoryId}`;
}

export function caseLibraryImageFile(caseId: string) {
  return path.join(CASE_LIBRARY_DIR, `${caseId}.webp`);
}

export function caseLibraryStatus() {
  const count = getOne<{ count: number }>(appDb, "select count(*) as count from case_items where id like ?", `${CASE_LIBRARY_ID_PREFIX}%`)?.count ?? 0;
  return { ...status, count };
}

function ensureCategories() {
  IMAGE_CATEGORIES.forEach((category, index) => {
    run(
      appDb,
      `insert into case_categories (id, type, name, slug, sort_order) values (?, 'case', ?, ?, ?)
       on conflict(id) do update set name = excluded.name`,
      caseLibraryCategoryId(category.id),
      category.label,
      `library-${category.id}`,
      200 + index
    );
  });
}

async function fileExists(file: string) {
  try {
    return (await stat(file)).size > 0;
  } catch {
    return false;
  }
}

async function fetchWithTimeout(url: string, timeoutMs: number) {
  const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return response;
}

async function syncOne(item: SourceCase) {
  const caseId = `${CASE_LIBRARY_ID_PREFIX}${item.id}`;
  const imageCategory = SOURCE_CATEGORY_TO_IMAGE_CATEGORY[item.category] ?? "general";
  const file = caseLibraryImageFile(caseId);
  if (!(await fileExists(file))) {
    const imagePath = item.image.startsWith("/") ? `/data${item.image}` : `/data/${item.image}`;
    const response = await fetchWithTimeout(`${REPOSITORY_RAW}${imagePath}`, 60_000);
    const source = Buffer.from(await response.arrayBuffer());
    const output = await sharp(source)
      .rotate()
      .resize({ width: CASE_IMAGE_MAX_SIZE, height: CASE_IMAGE_MAX_SIZE, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();
    await writeFile(file, output);
  }
  run(
    appDb,
    `insert into case_items (id, group_id, category_id, user_id, image_id, asset_id, include_references,
       review_status, title, prompt, image_url, created_at)
     values (?, ?, ?, null, null, null, 0, 'approved', ?, ?, ?, ?)
     on conflict(id) do update set category_id = excluded.category_id, title = excluded.title, prompt = excluded.prompt,
       image_url = excluded.image_url`,
    caseId,
    caseId,
    caseLibraryCategoryId(imageCategory),
    item.title.trim().slice(0, 120) || `案例 ${item.id}`,
    item.prompt.trim(),
    `/api/case-library/images/${caseId}.webp`,
    now()
  );
}

/** Starts a background sync; returns false when one is already running. */
export function startCaseLibrarySync() {
  if (status.running) return false;
  Object.assign(status, { running: true, total: 0, processed: 0, failed: 0, error: "", startedAt: now(), finishedAt: "" });
  void (async () => {
    try {
      await mkdir(CASE_LIBRARY_DIR, { recursive: true });
      const response = await fetchWithTimeout(`${REPOSITORY_RAW}/data/cases.json`, 60_000);
      const data = await response.json() as { cases?: SourceCase[] };
      const cases = (data.cases ?? []).filter((item) => item && Number.isFinite(item.id) && item.prompt && item.image);
      status.total = cases.length;
      ensureCategories();
      let cursor = 0;
      const worker = async () => {
        while (cursor < cases.length) {
          const item = cases[cursor++];
          try {
            await syncOne(item);
          } catch {
            status.failed += 1;
          }
          status.processed += 1;
        }
      };
      await Promise.all(Array.from({ length: DOWNLOAD_CONCURRENCY }, worker));
    } catch (error) {
      status.error = error instanceof Error ? error.message : String(error);
    } finally {
      status.running = false;
      status.finishedAt = now();
    }
  })();
  return true;
}

type LibraryCaseRow = { id: string; title: string; prompt: string };

function tokens(text: string) {
  const lower = text.toLowerCase();
  const words = lower.match(/[a-z][a-z0-9-]{2,}/g) ?? [];
  const cjk = lower.replace(/[^一-鿿]/g, "");
  const bigrams: string[] = [];
  for (let index = 0; index < cjk.length - 1; index += 1) bigrams.push(cjk.slice(index, index + 2));
  return new Set([...words, ...bigrams]);
}

/**
 * Picks the library cases in the same image category whose prompts share the most terms with
 * the request; used as structure/specificity references by the optimizer.
 */
export function referenceCasesForRequest(request: string, imageCategoryId: string, limit = 2) {
  const rows = getAll<LibraryCaseRow>(
    appDb,
    "select id, title, prompt from case_items where id like ? and category_id = ?",
    `${CASE_LIBRARY_ID_PREFIX}%`,
    caseLibraryCategoryId(imageCategoryId)
  );
  if (rows.length === 0) return [];
  const wanted = tokens(request);
  const preferChinese = /[\u4e00-\u9fff]/.test(request);
  const rowTerms = rows.map((row) => tokens(`${row.title} ${row.title} ${row.prompt}`));
  // Rare shared terms ("咖啡", "开业") matter; ones most cases share ("海报", "一张") barely count.
  const documentFrequency = new Map<string, number>();
  for (const terms of rowTerms) for (const term of terms) if (wanted.has(term)) documentFrequency.set(term, (documentFrequency.get(term) ?? 0) + 1);
  return rows
    .map((row, index) => {
      let score = 0;
      for (const term of wanted) {
        if (!rowTerms[index].has(term)) continue;
        score += Math.log(rows.length / (documentFrequency.get(term) ?? rows.length));
      }
      const sameLanguage = preferChinese === /[\u4e00-\u9fff]/.test(row.prompt);
      return { row, score: score > 0 && sameLanguage ? score * 1.2 : score };
    })
    .filter((item) => item.score >= MIN_REFERENCE_SCORE)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ row }) => ({ title: row.title, prompt: row.prompt.slice(0, 1500) }));
}
