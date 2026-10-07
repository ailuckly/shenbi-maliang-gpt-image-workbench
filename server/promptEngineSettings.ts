import { configDb, getOne, run } from "./db";
import { now } from "./utils";

// Admin-tunable defaults for the prompt engine (候选数 …). One row in config.db.
export type PromptEngineSettings = { candidateCount: number };

const DEFAULT_SETTINGS: PromptEngineSettings = { candidateCount: 3 };

function ensureTable() {
  configDb.run(`create table if not exists prompt_engine_settings (
    id text primary key,
    candidate_count integer not null default 3,
    updated_at text not null
  )`);
}

export function promptEngineSettings(): PromptEngineSettings {
  ensureTable();
  const row = getOne<{ candidate_count: number }>(configDb, "select candidate_count from prompt_engine_settings where id = 'default'");
  return { candidateCount: clampCandidates(row?.candidate_count ?? DEFAULT_SETTINGS.candidateCount) };
}

function clampCandidates(value: unknown) {
  const count = Math.trunc(Number(value));
  return Number.isFinite(count) ? Math.min(3, Math.max(1, count)) : DEFAULT_SETTINGS.candidateCount;
}

export function savePromptEngineSettings(input: Partial<PromptEngineSettings>) {
  ensureTable();
  const next = { ...promptEngineSettings(), ...(input.candidateCount !== undefined ? { candidateCount: clampCandidates(input.candidateCount) } : {}) };
  run(
    configDb,
    `insert into prompt_engine_settings (id, candidate_count, updated_at) values ('default', ?, ?)
     on conflict(id) do update set candidate_count = excluded.candidate_count, updated_at = excluded.updated_at`,
    next.candidateCount,
    now()
  );
  return next;
}
