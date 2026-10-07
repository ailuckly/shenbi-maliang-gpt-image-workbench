import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { request } from "../../api/client";
import { useI18n } from "../../i18n";
import { Button, ErrorState, Tag, useToast } from "../ui";
import "./setup.css";

type SetupIssue = {
  id: string;
  level: "error" | "warning" | "info";
  title: string;
  detail: string;
  tab: string;
  fix?: string;
};

type SetupStatus = {
  image: { id: string; name: string; model: string; routeMode: string; responsesModel: string; defaultQuality: string } | null;
  text: { id: string; name: string; model: string; temperature: number | null; status: string } | null;
  caseLibrary: { count: number };
  qualityCheck: { enabled: boolean };
  issues: SetupIssue[];
};

const setupApi = {
  status: (signal?: AbortSignal) => request<SetupStatus>("/api/config/setup-status", { signal }),
  fix: (action: string) => request<{ changed: number; status: SetupStatus }>("/api/config/setup-status/fix", { method: "POST", body: JSON.stringify({ action }) })
};

export function SetupOverviewPanel({ onNavigate }: { onNavigate: (tab: string) => void }) {
  const { t } = useI18n();
  const { showToast } = useToast();
  const cache = useQueryClient();
  const status = useQuery({ queryKey: ["config-setup-status"], queryFn: ({ signal }) => setupApi.status(signal) });
  const fix = useMutation({
    mutationFn: setupApi.fix,
    onSuccess: (result) => {
      cache.setQueryData(["config-setup-status"], result.status);
      void cache.invalidateQueries({ queryKey: ["config-language-model-assignments"] });
      showToast(t("v2.setup.fixed", { count: result.changed }));
    },
    onError: (error) => showToast(error instanceof Error ? error.message : t("v2.setup.failed"), "error")
  });
  const data = status.data;
  const route = data?.image?.routeMode ?? "";

  return (
    <section className="v2-page v2-stack setup-overview">
      <header>
        <h1>{t("v2.setup.title")}</h1>
        <p>{t("v2.setup.description")}</p>
      </header>
      {status.isError ? <ErrorState message={t("v2.setup.failed")} onRetry={() => void status.refetch()} /> : null}
      {data ? (
        <>
          <div className="setup-cards">
            <article className="setup-card">
              <span className="setup-card-label">{t("v2.setup.image")}</span>
              {data.image ? (
                <>
                  <strong>{data.image.name}</strong>
                  <dl>
                    <dt>{t("v2.setup.model")}</dt><dd>{data.image.model}</dd>
                    <dt>{t("v2.setup.route")}</dt><dd>{t("v2.admin.routeOption." + route)}</dd>
                    {route !== "images_api" ? <><dt>{t("v2.setup.rewriteModel")}</dt><dd>{data.image.responsesModel || "—"}</dd></> : null}
                    <dt>{t("v2.setup.quality")}</dt><dd>{data.image.defaultQuality || "auto"}</dd>
                  </dl>
                </>
              ) : <Tag tone="danger">{t("v2.setup.missing")}</Tag>}
              <Button onClick={() => onNavigate("providers")}>{t("v2.setup.manage")}</Button>
            </article>
            <article className="setup-card">
              <span className="setup-card-label">{t("v2.setup.text")}</span>
              {data.text ? (
                <>
                  <strong>{data.text.name}</strong>
                  <dl>
                    <dt>{t("v2.setup.model")}</dt><dd>{data.text.model}</dd>
                    <dt>{t("v2.setup.temperature")}</dt><dd>{data.text.temperature ?? t("v2.setup.default")}</dd>
                    <dt>{t("v2.setup.lastTest")}</dt><dd>{data.text.status === "normal" ? t("v2.setup.ok") : data.text.status || "—"}</dd>
                  </dl>
                </>
              ) : <Tag tone="danger">{t("v2.setup.missing")}</Tag>}
              <Button onClick={() => onNavigate("promptOptimizer")}>{t("v2.setup.manage")}</Button>
            </article>
            <article className="setup-card">
              <span className="setup-card-label">{t("v2.setup.promptEngine")}</span>
              <dl>
                <dt>{t("v2.setup.caseLibrary")}</dt><dd>{t("v2.setup.caseCount", { count: data.caseLibrary.count })}</dd>
                <dt>{t("v2.setup.qualityCheck")}</dt><dd>{data.qualityCheck.enabled ? t("v2.setup.on") : t("v2.setup.off")}</dd>
              </dl>
              <Button onClick={() => onNavigate("promptStrategy")}>{t("v2.setup.manage")}</Button>
            </article>
          </div>
          <section className="v2-stack">
            <h2>{t("v2.setup.issues")}</h2>
            {data.issues.length === 0 ? <p>{t("v2.setup.noIssues")}</p> : null}
            <ul className="setup-issues">
              {data.issues.map((issue) => (
                <li key={issue.id} className={`setup-issue is-${issue.level}`}>
                  <div>
                    <Tag tone={issue.level === "error" ? "danger" : "neutral"}>{t(`v2.setup.level.${issue.level}`)}</Tag>
                    <strong>{issue.title}</strong>
                    <p>{issue.detail}</p>
                  </div>
                  <div className="v2-row">
                    {issue.fix ? (
                      <Button variant="primary" onClick={() => fix.mutate(issue.fix!)} disabled={fix.isPending}>{t("v2.setup.fix")}</Button>
                    ) : null}
                    <Button onClick={() => onNavigate(issue.tab)}>{t("v2.setup.goTo")}</Button>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </>
      ) : null}
    </section>
  );
}
