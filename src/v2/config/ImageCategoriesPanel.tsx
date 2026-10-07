import { useQuery } from "@tanstack/react-query";
import { request } from "../../api/client";
import { useI18n } from "../../i18n";
import { ErrorState, Tag } from "../ui";
import "./setup.css";

type ImageCategoryView = { id: string; label: string; keywords: string[]; skeleton: string; pitfalls: string[] };

export function ImageCategoriesPanel() {
  const { t } = useI18n();
  const query = useQuery({
    queryKey: ["config-image-categories"],
    queryFn: ({ signal }) => request<{ source: string; categories: ImageCategoryView[] }>("/api/config/image-categories", { signal })
  });
  return (
    <section className="v2-page v2-stack">
      <header>
        <h1>{t("v2.categories.title")}</h1>
        <p>{t("v2.categories.description")}</p>
      </header>
      {query.isError ? <ErrorState message={t("v2.categories.failed")} onRetry={() => void query.refetch()} /> : null}
      <div className="category-list">
        {(query.data?.categories ?? []).map((category) => (
          <details key={category.id} className="category-item">
            <summary>
              <strong>{category.label}</strong>
              <small>{category.keywords.length ? category.keywords.slice(0, 8).join(" · ") : t("v2.categories.fallback")}</small>
            </summary>
            <div className="category-item-body">
              <Tag>{t("v2.categories.checklist")}</Tag>
              <pre>{category.skeleton}</pre>
              <Tag>{t("v2.categories.pitfalls")}</Tag>
              <ul>{category.pitfalls.map((item, index) => <li key={index}>{item}</li>)}</ul>
            </div>
          </details>
        ))}
      </div>
      {query.data ? <p>{t("v2.categories.source", { source: query.data.source })}</p> : null}
    </section>
  );
}
