import { useState } from "react";
import { useI18n } from "../../i18n";
import { useAppearanceMode } from "../../hooks/useAppearanceMode";
import { Button, Checkbox, Dialog, EmptyState, ErrorState, Input, Menu, Select, Skeleton, Tabs, Tag, Textarea, useToast } from ".";

// Authenticated development-only preview; excluded from production routes.
export function ComponentGallery() {
  const {t} = useI18n(); const {setMode} = useAppearanceMode(); const {showToast} = useToast();
  const [dialog,setDialog] = useState(false); const [tab,setTab] = useState("fields");
  return <section className="v2-page"><div className="v2-gallery v2-stack">
    <header className="v2-gallery-header"><h1>{t("v2.gallery.title")}</h1><p>{t("v2.gallery.description")}</p></header>
    <div className="v2-row"><Button onClick={() => setMode("light")}>{t("v2.light")}</Button><Button onClick={() => setMode("dark")}>{t("v2.dark")}</Button><Tag>{t("v2.gallery.tag")}</Tag></div>
    <Tabs value={tab} onValueChange={setTab} items={[
      {value:"fields",label:t("v2.gallery.fields"),content:<div className="v2-gallery-fields">
        <Input label={t("v2.gallery.name")} placeholder={t("v2.gallery.namePlaceholder")} />
        <Select label={t("v2.gallery.mode")} defaultValue="t2i"><option value="t2i">{t("v2.mode.t2i")}</option><option value="i2i">{t("v2.mode.i2i")}</option></Select>
        <div className="v2-gallery-wide"><Textarea label={t("v2.gallery.request")} placeholder={t("v2.gallery.requestPlaceholder")} /></div>
        <Input label={t("v2.gallery.errorField")} error={t("v2.gallery.errorDescription")} defaultValue="" />
        <Checkbox label={t("v2.gallery.checkbox")} />
      </div>},
      {value:"states",label:t("v2.gallery.states"),content:<div className="v2-stack"><EmptyState title={t("v2.gallery.empty")} description={t("v2.gallery.emptyDescription")} /><ErrorState message={t("v2.gallery.errorDescription")} onRetry={() => showToast(t("v2.gallery.feedback"),"info")} /><Skeleton /></div>}
    ]} />
    <div className="v2-row">
      <Button variant="primary" onClick={() => showToast(t("v2.gallery.feedback"))}>{t("v2.gallery.primary")}</Button><Button disabled>{t("v2.gallery.disabled")}</Button>
      <Menu trigger={<Button>{t("v2.gallery.menu")}</Button>} items={[{label:t("v2.gallery.feedback"),onSelect:()=>showToast(t("v2.gallery.feedback"))}]} />
      <Dialog open={dialog} onOpenChange={setDialog} title={t("v2.gallery.dialog")} description={t("v2.gallery.dialogDescription")} trigger={<Button>{t("v2.gallery.dialog")}</Button>}><Input label={t("v2.gallery.name")} /></Dialog>
    </div>
  </div></section>;
}
