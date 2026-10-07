import { MessageCircle, RotateCcw, Square, WandSparkles, X } from "lucide-react";
import { useI18n } from "../../i18n";
import { cx } from "../../lib/cx";
import type { PromptCandidate, PromptMode } from "../../v2/api";

export type PromptOptimizeRun = {
  id: number;
  scopeKey: string;
  source: string;
  mode: PromptMode;
  stylePackName: string;
  stylePackAddsText: boolean;
  /** Image category the optimizer used (自动识别), e.g. 海报与排版. */
  categoryLabel: string;
  /** Library cases the optimizer was shown as references. */
  exampleTitles: string[];
  /** 智能模式: show 生成 on each card instead of only filling the composer. */
  confirm: boolean;
  expected: number;
  /** "reply": the message was small talk, so `reply` answers it instead of candidates. */
  status: "running" | "done" | "error" | "reply";
  reply?: string;
  candidates: PromptCandidate[];
  failures: { index: number; error: string }[];
  error: string;
  appliedIndex: number | null;
};

export function candidatePromptText(candidate: PromptCandidate) {
  // `finalPrompt` already includes the style pack prefix; the pack is re-applied when sending.
  return candidate.structured.finalPrompt.trim() || candidate.finalPrompt.trim();
}

type PromptCandidatesBlockProps = {
  run: PromptOptimizeRun;
  onApply: (candidate: PromptCandidate) => void;
  onGenerate?: (candidate: PromptCandidate) => void;
  onRestore: () => void;
  onCancel: () => void;
  onDismiss: () => void;
  /** Generates the original message anyway after a small-talk reply. */
  onForceGenerate?: (source: string) => void;
};

export function PromptCandidatesBlock({ run, onApply, onGenerate, onRestore, onCancel, onDismiss, onForceGenerate }: PromptCandidatesBlockProps) {
  const { t } = useI18n();
  if (run.status === "reply") {
    return (
      <section className="prompt-candidates is-reply" aria-live="polite">
        <header className="prompt-candidates-header">
          <MessageCircle size={15} aria-hidden="true" />
          <span className="prompt-candidates-title">{t("v2.chat.intentReplyTitle")}</span>
          <span className="prompt-candidates-actions">
            <button
              type="button"
              className="prompt-candidates-action icon-only"
              onClick={onDismiss}
              aria-label={t("v2.chat.dismissCandidates")}
              title={t("v2.chat.dismissCandidates")}
            >
              <X size={14} aria-hidden="true" />
            </button>
          </span>
        </header>
        <p className="prompt-candidates-reply">{run.reply}</p>
        {onForceGenerate ? (
          <span className="prompt-candidate-actions">
            <button type="button" className="prompt-candidate-use" onClick={() => onForceGenerate(run.source)}>
              {t("v2.chat.intentForceGenerate")}
            </button>
          </span>
        ) : null}
      </section>
    );
  }
  const running = run.status === "running";
  const slots = Array.from({ length: run.expected }, (_, index) => index);
  const failedEverything = run.status === "error" && run.candidates.length === 0;

  return (
    <section className="prompt-candidates" aria-live="polite" aria-busy={running}>
      <header className="prompt-candidates-header">
        <WandSparkles size={15} aria-hidden="true" />
        <span className="prompt-candidates-title">
          {running ? t("v2.chat.optimizing") : run.confirm ? t("v2.chat.confirmTitle") : t("v2.chat.candidatesTitle")}
        </span>
        {run.categoryLabel ? <span className="prompt-candidates-pack">{t("v2.chat.categoryTag", { name: run.categoryLabel })}</span> : null}
        {run.stylePackName ? <span className="prompt-candidates-pack">{run.stylePackName}</span> : null}
        <span className="prompt-candidates-actions">
          {running ? (
            <button type="button" className="prompt-candidates-action" onClick={onCancel}>
              <Square size={13} aria-hidden="true" />
              <span>{t("v2.chat.stopOptimize")}</span>
            </button>
          ) : null}
          {run.appliedIndex !== null ? (
            <button type="button" className="prompt-candidates-action" onClick={onRestore}>
              <RotateCcw size={13} aria-hidden="true" />
              <span>{t("v2.chat.restoreOriginal")}</span>
            </button>
          ) : null}
          <button
            type="button"
            className="prompt-candidates-action icon-only"
            onClick={onDismiss}
            aria-label={t("v2.chat.dismissCandidates")}
            title={t("v2.chat.dismissCandidates")}
          >
            <X size={14} aria-hidden="true" />
          </button>
        </span>
      </header>
      {failedEverything ? (
        <p className="prompt-candidates-error">{run.error || t("v2.chat.optimizeFailed")}</p>
      ) : (
        <div className="prompt-candidates-list">
          {slots.map((index) => {
            const candidate = run.candidates.find((item) => item.index === index);
            const failure = run.failures.find((item) => item.index === index);
            if (candidate) {
              const applied = run.appliedIndex === index;
              return (
                <article key={index} className={cx("prompt-candidate", applied && "is-applied")}>
                  <span className="prompt-candidate-label">{t("v2.chat.candidateLabel", { number: index + 1 })}</span>
                  <p className="prompt-candidate-text">{candidatePromptText(candidate)}</p>
                  {candidate.structured.negative.trim() ? (
                    <p className="prompt-candidate-negative">
                      {t("v2.chat.negativeShort", { text: candidate.structured.negative.trim() })}
                    </p>
                  ) : null}
                  <span className="prompt-candidate-actions">
                    {run.confirm && onGenerate ? (
                      <button type="button" className="prompt-candidate-use is-primary" onClick={() => onGenerate(candidate)}>
                        {t("v2.chat.generateCandidate")}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="prompt-candidate-use"
                      onClick={() => onApply(candidate)}
                      aria-pressed={applied}
                    >
                      {applied ? t("v2.chat.candidateApplied") : run.confirm ? t("v2.chat.editCandidate") : t("v2.chat.useCandidate")}
                    </button>
                  </span>
                </article>
              );
            }
            if (failure) {
              return (
                <article key={index} className="prompt-candidate is-failed">
                  <span className="prompt-candidate-label">{t("v2.chat.candidateLabel", { number: index + 1 })}</span>
                  <p className="prompt-candidate-text">{t("v2.chat.candidateFailed", { error: failure.error })}</p>
                </article>
              );
            }
            if (!running) return null;
            return (
              <article key={index} className="prompt-candidate is-loading" aria-hidden="true">
                <span className="prompt-candidate-label">{t("v2.chat.candidateLabel", { number: index + 1 })}</span>
                <span className="prompt-candidate-skeleton" />
                <span className="prompt-candidate-skeleton short" />
              </article>
            );
          })}
        </div>
      )}
      {run.exampleTitles.length > 0 ? (
        <p className="prompt-candidates-note">{t("v2.chat.referencesUsed", { titles: run.exampleTitles.join("、") })}</p>
      ) : null}
      {run.stylePackAddsText && run.candidates.length > 0 ? (
        <p className="prompt-candidates-note">{t("v2.chat.stylePackNote", { name: run.stylePackName })}</p>
      ) : null}
    </section>
  );
}
