import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, LoaderCircle } from "lucide-react";
import { request } from "../../api/client";
import { useI18n } from "../../i18n";

export const QUALITY_FIX_EVENT = "shenbi:quality-fix";
export type QualityFixDetail = { imageId: string; prompt: string };

type QualityCheck = {
  imageId: string;
  status: "pending" | "done" | "failed";
  passed: boolean | null;
  score: number | null;
  issues: { type: string; detail: string }[];
  suggestion: string;
  error: string;
};

// A just-finished image may not have its check row yet; keep looking for a short while.
const FRESH_IMAGE_MS = 3 * 60 * 1000;

export function ImageQualityCheck({ imageId, createdAt }: { imageId: string; createdAt: string }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLSpanElement | null>(null);
  const fresh = Date.now() - new Date(createdAt).getTime() < FRESH_IMAGE_MS;
  const query = useQuery({
    queryKey: ["image-quality-check", imageId],
    queryFn: ({ signal }) => request<{ checks: QualityCheck[] }>(`/api/image-quality-checks?imageIds=${encodeURIComponent(imageId)}`, { signal }),
    refetchInterval: (state) => {
      const check = state.state.data?.checks[0];
      if (check?.status === "pending") return 3000;
      if (!check && fresh) return 4000;
      return false;
    }
  });

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open]);

  const check = query.data?.checks[0];
  if (!check) return null;
  if (check.status === "pending") {
    return (
      <span className="image-quality-chip is-pending" role="status">
        <LoaderCircle size={14} className="spin" aria-hidden="true" />
        {t("v2.quality.pending")}
      </span>
    );
  }
  if (check.status === "failed") {
    return <span className="image-quality-chip is-muted" title={check.error}>{t("v2.quality.unavailable")}</span>;
  }
  if (check.passed) {
    return (
      <span className="image-quality-chip is-passed" title={t("v2.quality.passedTitle")}>
        <CheckCircle2 size={14} aria-hidden="true" />
        {t("v2.quality.passed")}
      </span>
    );
  }
  const applyFix = () => {
    const prompt = check.suggestion.trim() || check.issues.map((issue) => issue.detail).join("；");
    window.dispatchEvent(new CustomEvent<QualityFixDetail>(QUALITY_FIX_EVENT, { detail: { imageId, prompt } }));
    setOpen(false);
  };
  return (
    <span className="image-quality-wrap" ref={wrapRef}>
      <button type="button" className="image-quality-chip is-warning" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
        <AlertTriangle size={14} aria-hidden="true" />
        {t("v2.quality.issues", { count: check.issues.length || 1 })}
      </button>
      {open ? (
        <span className="image-quality-panel" role="dialog" aria-label={t("v2.quality.panelTitle")}>
          <strong>{t("v2.quality.panelTitle")}</strong>
          <ul>
            {check.issues.map((issue, index) => (
              <li key={index}>
                <span className="image-quality-type">{t(`v2.quality.type.${issue.type}`)}</span>
                {issue.detail}
              </li>
            ))}
          </ul>
          {check.suggestion ? <p>{t("v2.quality.suggestion", { text: check.suggestion })}</p> : null}
          <button type="button" className="image-quality-fix" onClick={applyFix}>{t("v2.quality.fix")}</button>
        </span>
      ) : null}
    </span>
  );
}
