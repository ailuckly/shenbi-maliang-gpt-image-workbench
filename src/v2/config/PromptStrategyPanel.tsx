import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { request } from "../../api/client";
import { GlobalSwitchRow } from "../../config/shared/components";
import { useI18n } from "../../i18n";
import { Select, useToast } from "../ui";

type PromptEngineSettings = { candidateCount: number };

export function PromptStrategyPanel() {
  const { t } = useI18n();
  const { showToast } = useToast();
  const cache = useQueryClient();
  const settings = useQuery({
    queryKey: ["config-prompt-engine-settings"],
    queryFn: ({ signal }) => request<PromptEngineSettings>("/api/config/prompt-engine/settings", { signal })
  });
  const save = useMutation({
    mutationFn: (next: PromptEngineSettings) => request<PromptEngineSettings>("/api/config/prompt-engine/settings", { method: "PUT", body: JSON.stringify(next) }),
    onSuccess: (data) => {
      cache.setQueryData(["config-prompt-engine-settings"], data);
      void cache.invalidateQueries({ queryKey: ["config-setup-status"] });
      showToast(t("v2.strategy.saved"));
    },
    onError: (error) => showToast(error instanceof Error ? error.message : t("v2.strategy.failed"), "error")
  });
  return (
    <section className="v2-page v2-stack v2-narrow">
      <header>
        <h1>{t("v2.strategy.title")}</h1>
        <p>{t("v2.strategy.description")}</p>
      </header>
      <Select
        label={t("v2.strategy.candidates")}
        value={String(settings.data?.candidateCount ?? 3)}
        onChange={(event) => save.mutate({ candidateCount: Number(event.target.value) })}
        disabled={!settings.data || save.isPending}
      >
        {[1, 2, 3].map((count) => <option key={count} value={count}>{t("v2.strategy.candidateOption", { count })}</option>)}
      </Select>
      <p className="v2-field-hint">{t("v2.strategy.candidatesHint")}</p>
      <GlobalSwitchRow
        type="image_quality_check"
        title={t("v2.strategy.qualityCheck")}
        desc={t("v2.strategy.qualityCheckHint")}
        defaultEnabled
        invalidateQueryKeys={["config-setup-status"]}
      />
      <GlobalSwitchRow
        type="prompt_injection_review"
        title={t("v2.strategy.injectionReview")}
        desc={t("v2.strategy.injectionReviewHint")}
        defaultEnabled
      />
      <GlobalSwitchRow
        type="image_text_leak_check"
        title={t("v2.strategy.imageTextLeak")}
        desc={t("v2.strategy.imageTextLeakHint")}
        defaultEnabled
      />
      <p className="v2-field-hint">{t("v2.strategy.modelHint")}</p>
    </section>
  );
}
