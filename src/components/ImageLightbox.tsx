import { useEffect, useRef } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { ChevronLeft, ChevronRight, Download, X } from "lucide-react";
import { useI18n } from "../i18n";
import { cx } from "../lib/cx";
import { CheckerboardImage } from "./CheckerboardImage";

export type ImageLightboxTarget = {
  url: string;
  downloadUrl?: string;
  thumbnailUrl?: string;
  name: string;
};

export type ImageLightboxState = {
  items: ImageLightboxTarget[];
  index: number;
};

export function ImageLightbox({
  state,
  onClose,
  onChangeIndex
}: {
  state: ImageLightboxState | null;
  onClose: () => void;
  onChangeIndex: (index: number) => void;
}) {
  const { t } = useI18n();
  const items = state?.items ?? [];
  const index = Math.max(0, Math.min(state?.index ?? 0, Math.max(0, items.length - 1)));
  const activeItem = items[index] ?? null;
  const canSwitch = items.length > 1;
  const returnFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!activeItem) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (!canSwitch) return;
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") event.preventDefault();
      if (event.key === "ArrowLeft") onChangeIndex(index <= 0 ? items.length - 1 : index - 1);
      if (event.key === "ArrowRight") onChangeIndex(index >= items.length - 1 ? 0 : index + 1);
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeItem, canSwitch, index, items.length, onChangeIndex, onClose]);

  if (!activeItem) return null;

  const goByOffset = (offset: number) => {
    if (!canSwitch) return;
    const nextIndex = (index + offset + items.length) % items.length;
    onChangeIndex(nextIndex);
  };

  return <Dialog.Root open onOpenChange={open => { if (!open) onClose(); }}><Dialog.Portal><Dialog.Content asChild aria-describedby={undefined}
    onOpenAutoFocus={() => { returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null; }}
    onCloseAutoFocus={event => { if (returnFocus.current?.isConnected) { event.preventDefault(); returnFocus.current.focus(); } }}>
    <div className={cx("reference-image-lightbox", canSwitch && "has-thumbs")} onMouseDown={onClose}>
      <Dialog.Title className="sr-only">{t("imageLightbox.preview")}</Dialog.Title>
      {activeItem.downloadUrl ? (
        <a
          className="reference-image-download"
          href={activeItem.downloadUrl}
          download={activeItem.name}
          rel="noopener"
          onMouseDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
          aria-label={t("imagePreview.downloadReference")}
          title={t("imagePreview.downloadReference")}
        >
          <Download size={20} />
        </a>
      ) : null}
      <button
        type="button"
        className="reference-image-close"
        onMouseDown={(event) => event.stopPropagation()}
        onClick={onClose}
        aria-label={t("imageLightbox.close")}
      >
        <X size={20} />
      </button>
      {canSwitch ? (
        <button
          type="button"
          className="reference-image-step reference-image-step-prev"
          onMouseDown={(event) => event.stopPropagation()}
          onClick={() => goByOffset(-1)}
          aria-label={t("imageLightbox.previous")}
        >
          <ChevronLeft size={26} />
        </button>
      ) : null}
      <div className="reference-image-frame" onMouseDown={(event) => event.stopPropagation()}>
        <CheckerboardImage src={activeItem.url} alt={activeItem.name} />
      </div>
      {canSwitch ? (
        <>
          <button
            type="button"
            className="reference-image-step reference-image-step-next"
            onMouseDown={(event) => event.stopPropagation()}
            onClick={() => goByOffset(1)}
            aria-label={t("imageLightbox.next")}
          >
            <ChevronRight size={26} />
          </button>
          <div className="reference-image-thumbs" onMouseDown={(event) => event.stopPropagation()} aria-label={t("imageLightbox.thumbnails")}>
            {items.map((item, itemIndex) => (
              <button
                key={`${item.url}-${itemIndex}`}
                type="button"
                className={cx(itemIndex === index && "active")}
                onClick={() => onChangeIndex(itemIndex)}
                aria-label={t("imageLightbox.viewNth", { index: itemIndex + 1 })}
                aria-pressed={itemIndex === index}
              >
                <CheckerboardImage src={item.thumbnailUrl ?? item.url} alt={item.name} />
              </button>
            ))}
          </div>
        </>
      ) : null}
    </div></Dialog.Content></Dialog.Portal></Dialog.Root>;
}
