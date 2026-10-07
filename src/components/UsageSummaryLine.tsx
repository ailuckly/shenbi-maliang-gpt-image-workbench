import { useQuery } from "@tanstack/react-query";
import { Gauge } from "lucide-react";
import { request } from "../api/client";
import { useI18n } from "../i18n";

type UsageSummary = {
  tier: { name: string };
  today: { images: number; optimizes: number };
  limits: { dailyImageLimit: number; dailyOptimizeLimit: number };
};

function remaining(limit: number, used: number) {
  return limit > 0 ? String(Math.max(0, limit - used)) : "∞";
}

/** Today's remaining quota for the signed-in user; 0 limits mean unlimited. */
export function UsageSummaryLine() {
  const { t } = useI18n();
  const usage = useQuery({
    queryKey: ["me", "usage"],
    queryFn: () => request<UsageSummary>("/api/me/usage"),
    staleTime: 15_000
  });
  if (!usage.data) return null;
  const { tier, today, limits } = usage.data;
  const unlimited = limits.dailyImageLimit <= 0 && limits.dailyOptimizeLimit <= 0;
  return (
    <div className="user-info-usage" title={t("v2.usage.tier", { name: tier.name })}>
      <Gauge size={16} aria-hidden="true" />
      <span>
        <strong>{t("v2.usage.tier", { name: tier.name })}</strong>
        <span>
          {unlimited
            ? t("v2.usage.unlimited")
            : t("v2.usage.remaining", {
                images: remaining(limits.dailyImageLimit, today.images),
                optimizes: remaining(limits.dailyOptimizeLimit, today.optimizes)
              })}
        </span>
      </span>
    </div>
  );
}
