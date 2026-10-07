import { mkdir, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { appDb, getAll, getOne, run } from "./db";
import { FILES_DIR } from "./paths";
import { IMAGE_CATEGORIES } from "./promptEngine/imageCategories";
import { now } from "./utils";
import { CASE_LIBRARY_SOURCES, sourceCaseId, sourceImageCategory, fetchCaseSource, type SourceCase, type ModelFamily } from "./caseLibrarySources";

export const CASE_LIBRARY_DIR = path.join(FILES_DIR, "case-library");
export const CASE_LIBRARY_ID_PREFIX = "library-";
const CASE_IMAGE_MAX_SIZE = 1280;
const DOWNLOAD_CONCURRENCY = 6;
// Below this relevance a reference case is more likely to mislead than help.
const MIN_REFERENCE_SCORE = 2;

export type CaseLibraryStatus = {
  running: boolean;
  total: number;
  processed: number;
  failed: number;
  error: string;
  startedAt: string;
  finishedAt: string;
};

const emptyStatus = (): CaseLibraryStatus => ({ running: false, total: 0, processed: 0, failed: 0, error: "", startedAt: "", finishedAt: "" });
const sourceStatuses = new Map(CASE_LIBRARY_SOURCES.map((source) => [source.id, emptyStatus()]));
const status: CaseLibraryStatus = { running: false, total: 0, processed: 0, failed: 0, error: "", startedAt: "", finishedAt: "" };

export function caseLibraryCategoryId(imageCategoryId: string) {
  return `casecat_library_${imageCategoryId}`;
}

export function caseLibraryImageFile(caseId: string) {
  return path.join(CASE_LIBRARY_DIR, `${caseId}.webp`);
}

export function caseLibraryStatus() {
  const count = getOne<{ count: number }>(appDb, "select count(*) as count from case_items where id like ?", `${CASE_LIBRARY_ID_PREFIX}%`)?.count ?? 0;
  const sources = CASE_LIBRARY_SOURCES.map((source) => ({
    id: source.id, name: source.name, license: source.license,
    count: getOne<{ count: number }>(appDb, "select count(*) as count from case_library_meta where source = ?", source.id)?.count ?? 0,
    status: { ...sourceStatuses.get(source.id)! }
  }));
  return { ...status, count, sources };
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

async function syncOne(item: SourceCase, source: typeof CASE_LIBRARY_SOURCES[number]) {
  const caseId = sourceCaseId(source, item);
  const imageCategory = sourceImageCategory(item);
  const file = caseLibraryImageFile(caseId);
  if (!(await fileExists(file))) {
    const response = await fetchCaseSource(item.image);
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
  run(appDb, `insert into case_library_meta (case_id, source, model_family, tags_json, created_at)
    values (?, ?, ?, ?, ?) on conflict(case_id) do update set source = excluded.source,
    model_family = excluded.model_family, tags_json = excluded.tags_json`,
    caseId, source.id, source.modelFamily, JSON.stringify(item.tags), now());
}

/** A tightened selection rule should also take previously synced cases out of the library. */
function removeUnselectedCases(sourceId: string, keep: Set<string>) {
  const stale = getAll<{ case_id: string }>(appDb, "select case_id from case_library_meta where source = ?", sourceId)
    .map((row) => row.case_id)
    .filter((caseId) => !keep.has(caseId));
  for (const caseId of stale) {
    run(appDb, "delete from case_items where id = ?", caseId);
    run(appDb, "delete from case_library_meta where case_id = ?", caseId);
    void unlink(caseLibraryImageFile(caseId)).catch(() => undefined);
  }
}

/** Starts a background sync; returns false when one is already running. */
export function startCaseLibrarySync(sourceId?: string) {
  const sources = sourceId === undefined ? CASE_LIBRARY_SOURCES : CASE_LIBRARY_SOURCES.filter((source) => source.id === sourceId);
  if (!sources.length) throw new Error("Unknown case-library source");
  if (status.running) return false;
  Object.assign(status, emptyStatus(), { running: true, startedAt: now() });
  void (async () => {
    try {
      await mkdir(CASE_LIBRARY_DIR, { recursive: true });
      ensureCategories();
      for (const source of sources) {
        const current = sourceStatuses.get(source.id)!;
        Object.assign(current, emptyStatus(), { running: true, startedAt: now() });
        try {
          const cases = source.select(source.parse(await source.fetch()));
          current.total = cases.length;
          status.total += cases.length;
          let cursor = 0;
          const worker = async () => {
            while (cursor < cases.length) {
              const item = cases[cursor++];
              try { await syncOne(item, source); }
              catch { current.failed += 1; status.failed += 1; }
              current.processed += 1;
              status.processed += 1;
            }
          };
          await Promise.all(Array.from({ length: DOWNLOAD_CONCURRENCY }, worker));
          removeUnselectedCases(source.id, new Set(cases.map((item) => sourceCaseId(source, item))));
        } catch (error) {
          current.error = error instanceof Error ? error.message : String(error);
          status.error = [status.error, `${source.id}: ${current.error}`].filter(Boolean).join("; ");
        } finally { current.running = false; current.finishedAt = now(); }
      }
    } catch (error) { status.error = error instanceof Error ? error.message : String(error); }
    finally { status.running = false; status.finishedAt = now(); }
  })();
  return true;
}

type LibraryCaseRow = { id: string; title: string; prompt: string; model_family: string | null };

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
export function referenceCasesForRequest(request: string, imageCategoryId: string, limit = 2, modelFamily?: ModelFamily) {
  const rows = getAll<LibraryCaseRow>(
    appDb,
    "select c.id, c.title, c.prompt, m.model_family from case_items c left join case_library_meta m on m.case_id = c.id where c.id like ? and c.category_id = ?",
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
      // Prompts written for the selected model family (GPT Image vs Gemini) transfer better.
      const sameFamily = Boolean(modelFamily) && row.model_family === modelFamily;
      const weighted = score > 0 && sameLanguage ? score * 1.2 : score;
      return { row, score: score > 0 && sameFamily ? weighted * 1.3 : weighted };
    })
    .filter((item) => item.score >= MIN_REFERENCE_SCORE)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ row }) => ({ title: row.title, prompt: row.prompt.slice(0, 1500) }));
}
