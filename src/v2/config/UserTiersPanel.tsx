import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { configApi } from "../../api";
import type { UserTier } from "../../api/config";
import { useI18n } from "../../i18n";
import { Button, Checkbox, Dialog, ErrorState, Input, Select, Skeleton, Textarea, useToast } from "../ui";

type TierFields = Omit<UserTier, "id" | "createdAt" | "updatedAt">;
const emptyTier: TierFields = { name: "", description: "", allowedModels: [], maxQuality: "high", dailyImageLimit: 0, dailyOptimizeLimit: 0, isDefault: false, sortOrder: 0 };

export function UserTiersPanel() {
  const { t } = useI18n();
  const cache = useQueryClient();
  const { showToast } = useToast();
  const focus = useRef<HTMLButtonElement>(null);
  const tiers = useQuery({ queryKey: ["config-user-tiers"], queryFn: configApi.userTiers });
  const [editing, setEditing] = useState<{ tier?: UserTier } | null>(null);
  const [deleting, setDeleting] = useState<UserTier | null>(null);
  function refresh() {
    void cache.invalidateQueries({ queryKey: ["config-user-tiers"] });
    void cache.invalidateQueries({ queryKey: ["config-users"] });
  }
  const save = useMutation({
    mutationFn: (fields: TierFields) => configApi.saveUserTier(fields, editing?.tier?.id),
    onSuccess: () => { setEditing(null); refresh(); showToast(t("v2.tiers.saved")); }
  });
  const remove = useMutation({ mutationFn: configApi.deleteUserTier, onSuccess: () => { setDeleting(null); refresh(); showToast(t("v2.tiers.deleted")); } });
  return <section className="v2-page v2-stack">
    <header><h1>{t("config.nav.userTiers")}</h1><p>{t("v2.tiers.description")}</p></header>
    <Button ref={focus} variant="primary" onClick={() => { save.reset(); setEditing({}); }}>{t("v2.tiers.new")}</Button>
    {tiers.isPending ? <Skeleton /> : null}
    {tiers.error ? <ErrorState message={tiers.error.message} onRetry={() => void tiers.refetch()} /> : null}
    <div className="table-wrap"><table>
      <thead><tr>{["v2.admin.name", "v2.tiers.models", "v2.tiers.quality", "v2.tiers.imageLimit", "v2.tiers.optimizeLimit", "v2.tiers.default", "v2.admin.sort", "v2.tiers.actions"].map(key => <th key={key}>{t(key)}</th>)}</tr></thead>
      <tbody>{tiers.data?.tiers.map(tier => <tr key={tier.id}>
        <td>{tier.name}<p>{tier.description}</p></td><td>{tier.allowedModels.join(", ") || t("v2.tiers.allModels")}</td><td>{tier.maxQuality}</td>
        <td>{tier.dailyImageLimit || t("v2.tiers.unlimited")}</td><td>{tier.dailyOptimizeLimit || t("v2.tiers.unlimited")}</td>
        <td>{tier.isDefault ? t("v2.tiers.default") : "—"}</td><td>{tier.sortOrder}</td>
        <td><Button onClick={event => { focus.current = event.currentTarget; save.reset(); setEditing({ tier }); }}>{t("common.edit")}</Button> <Button variant="danger" disabled={tier.isDefault} onClick={event => { focus.current = event.currentTarget; remove.reset(); setDeleting(tier); }}>{t("common.delete")}</Button></td>
      </tr>)}</tbody>
    </table></div>
    {editing ? <TierEditor key={editing.tier?.id ?? "new"} tier={editing.tier} error={save.error?.message} saving={save.isPending} onSave={fields => save.mutate(fields)} onClose={() => setEditing(null)} returnFocus={focus} /> : null}
    <Dialog open={Boolean(deleting)} title={t("v2.tiers.delete")} description={t("v2.tiers.deleteHint", { name: deleting?.name ?? "" })} onOpenChange={open => { if (!open) setDeleting(null); }} returnFocus={focus}>
      {remove.error ? <ErrorState message={remove.error.message} /> : null}
      <Button variant="danger" disabled={remove.isPending} onClick={() => deleting && remove.mutate(deleting.id)}>{t("common.delete")}</Button>
    </Dialog>
  </section>;
}

function TierEditor({ tier, error, saving, onSave, onClose, returnFocus }: {
  tier?: UserTier; error?: string; saving: boolean; onSave: (fields: TierFields) => void; onClose: () => void; returnFocus: React.RefObject<HTMLButtonElement | null>;
}) {
  const { t } = useI18n();
  const [form, setForm] = useState<TierFields>(() => tier ? (({ id, createdAt, updatedAt, ...fields }) => fields)(tier) : emptyTier);
  const [models, setModels] = useState(form.allowedModels.join(", "));
  return <Dialog open title={t(tier ? "v2.tiers.edit" : "v2.tiers.new")} onOpenChange={open => { if (!open) onClose(); }} returnFocus={returnFocus}>
    <form className="v2-stack" onSubmit={event => { event.preventDefault(); onSave({ ...form, allowedModels: models.split(/[,\n]/).map(model => model.trim()).filter(Boolean) }); }}>
      <Input label={t("v2.admin.name")} value={form.name} maxLength={100} required autoFocus onChange={event => setForm({ ...form, name: event.target.value })} />
      <Textarea label={t("v2.pack.summary")} value={form.description} maxLength={2000} onChange={event => setForm({ ...form, description: event.target.value })} />
      <Textarea label={t("v2.tiers.models")} value={models} aria-describedby="tier-models-hint" onChange={event => setModels(event.target.value)} />
      <p id="tier-models-hint" className="v2-field-hint">{t("v2.tiers.modelsHint")}</p>
      <Select label={t("v2.tiers.quality")} value={form.maxQuality} aria-describedby="tier-quality-hint" onChange={event => setForm({ ...form, maxQuality: event.target.value as UserTier["maxQuality"] })}>
        {["low", "medium", "high", "xhigh", "max"].map(quality => <option key={quality}>{quality}</option>)}
      </Select>
      <p id="tier-quality-hint" className="v2-field-hint">{t("v2.tiers.qualityHint")}</p>
      <Input label={t("v2.tiers.imageLimit")} type="number" min={0} max={1000000} step={1} required value={form.dailyImageLimit} aria-describedby="tier-limits-hint" onChange={event => setForm({ ...form, dailyImageLimit: Number(event.target.value) })} />
      <Input label={t("v2.tiers.optimizeLimit")} type="number" min={0} max={1000000} step={1} required value={form.dailyOptimizeLimit} aria-describedby="tier-limits-hint" onChange={event => setForm({ ...form, dailyOptimizeLimit: Number(event.target.value) })} />
      <p id="tier-limits-hint" className="v2-field-hint">{t("v2.tiers.limitsHint")}</p>
      <Input label={t("v2.admin.sort")} type="number" min={-1000000} max={1000000} step={1} required value={form.sortOrder} onChange={event => setForm({ ...form, sortOrder: Number(event.target.value) })} />
      <Checkbox label={t("v2.tiers.defaultHint")} checked={form.isDefault} disabled={tier?.isDefault} onChange={event => setForm({ ...form, isDefault: event.target.checked })} />
      {error ? <ErrorState message={error} /> : null}
      <Button type="submit" variant="primary" disabled={saving || !form.name.trim()}>{t("common.save")}</Button>
    </form>
  </Dialog>;
}
