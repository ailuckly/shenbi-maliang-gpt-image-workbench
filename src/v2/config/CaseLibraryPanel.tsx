import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { request } from "../../api/client";
import { useI18n } from "../../i18n";
import { Button, ErrorState, useToast } from "../ui";

type CaseLibraryStatus = {
  running: boolean;
  total: number;
  processed: number;
  failed: number;
  error: string;
  startedAt: string;
  finishedAt: string;
  count: number;
  sources: { id: string; name: string; license: string; count: number; status: {
    running: boolean; total: number; processed: number; failed: number; error: string; finishedAt: string;
  } }[];
};

const caseLibraryApi = {
  status: (signal?: AbortSignal) => request<CaseLibraryStatus>("/api/config/case-library", { signal }),
  sync: (source?: string) => request<{ started: boolean; status: CaseLibraryStatus }>("/api/config/case-library/sync", { method: "POST", body: JSON.stringify(source ? { source } : {}) })
};

export function CaseLibraryPanel() {
  const { t } = useI18n();
  const { showToast } = useToast();
  const cache = useQueryClient();
  const status = useQuery({
    queryKey: ["config-case-library"],
    queryFn: ({ signal }) => caseLibraryApi.status(signal),
    refetchInterval: (query) => (query.state.data?.running ? 1500 : false)
  });
  const sync = useMutation({
    mutationFn: caseLibraryApi.sync,
    onSuccess: (result) => {
      cache.setQueryData(["config-case-library"], result.status);
      showToast(t("v2.caseLibrary.started"));
    },
    onError: (error) => showToast(error instanceof Error ? error.message : t("v2.caseLibrary.failed"), "error")
  });
  const data = status.data;
  const running = Boolean(data?.running);

  return (
    <section className="v2-page v2-stack">
      <header>
        <h1>{t("v2.caseLibrary.title")}</h1>
        <p>{t("v2.caseLibrary.sourcesDescription")}</p>
      </header>
      {status.isError ? <ErrorState message={t("v2.caseLibrary.failed")} onRetry={() => void status.refetch()} /> : null}
      <div className="v2-row">
        <strong>{t("v2.caseLibrary.count", { count: data?.count ?? 0 })}</strong>
        <Button variant="primary" onClick={() => sync.mutate(undefined)} disabled={running || sync.isPending}>
          {running ? t("v2.caseLibrary.syncing") : data?.count ? t("v2.caseLibrary.resync") : t("v2.caseLibrary.sync")}
        </Button>
      </div>
      {running && data ? (
        <p aria-live="polite">{t("v2.caseLibrary.progress", { processed: data.processed, total: data.total || "…", failed: data.failed })}</p>
      ) : null}
      {!running && data?.finishedAt ? (
        <p>{data.error ? t("v2.caseLibrary.lastError", { error: data.error }) : t("v2.caseLibrary.lastResult", { processed: data.processed, failed: data.failed })}</p>
      ) : null}
      {data?.sources.map((source) => (
        <section key={source.id} className="v2-stack" aria-label={source.name}>
          <div className="v2-row">
            <strong>{source.name}</strong>
            <span>{t("v2.caseLibrary.count", { count: source.count })}</span>
            <span>{t("v2.caseLibrary.license", { license: source.license })}</span>
            <Button onClick={() => sync.mutate(source.id)} disabled={running || sync.isPending}>
              {source.status.running ? t("v2.caseLibrary.syncing") : t("v2.caseLibrary.syncSource")}
            </Button>
          </div>
          {source.status.running ? (
            <p aria-live="polite">{t("v2.caseLibrary.progress", { processed: source.status.processed, total: source.status.total || "…", failed: source.status.failed })}</p>
          ) : source.status.finishedAt ? (
            <p>{source.status.error ? t("v2.caseLibrary.lastError", { error: source.status.error }) : t("v2.caseLibrary.lastResult", { processed: source.status.processed, failed: source.status.failed })}</p>
          ) : null}
        </section>
      ))}
      <p>{t("v2.caseLibrary.usage")}</p>
    </section>
  );
}
