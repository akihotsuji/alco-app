import { ChevronRight, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { FieldLabel } from "@/client/components/form/FieldLabel.tsx";
import { ContentPhoto, PHOTO_DISPLAY_SIZE } from "@/client/components/photo/ContentPhoto.tsx";
import {
  DialogContent,
  DialogDescription,
  Dialog as DialogRoot,
  DialogTitle,
} from "@/client/components/ui/dialog.tsx";
import { Input } from "@/client/components/ui/input.tsx";
import { useBottle, useBottles } from "@/client/hooks/use-bottles.ts";
import { photoContentUrl } from "@/client/hooks/use-photos.ts";
import { vintageLabel } from "@/client/lib/bottle-form.ts";
import { pickerBottlesQueryEnabled, pickerRowClassName } from "@/client/lib/bottle-picker.ts";
import { type BottleStatus, DRINK_TYPE_LABELS, type DrinkType } from "@/shared/constants.ts";

function useDebounced(value: string, ms: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), ms);
    return () => window.clearTimeout(timer);
  }, [value, ms]);
  return debounced;
}

export type PickedBottle = {
  id: string;
  name: string;
  drinkType: DrinkType;
  status: BottleStatus;
  vintage: number | null;
  producer: string | null;
  origin: string | null;
  variety: string | null;
  thumbPhotoId: string | null;
};

type BottlePickerRowProps = {
  bottleId: string | null;
  bottleName: string | null;
  label?: string;
  hint?: string;
  emptyValue?: string;
  valueLabel?: string;
  clearable?: boolean;
  requireSearch?: boolean;
  /** 通常フォームは保存直前の任意行。大きなカードにしない */
  placement?: "field" | "optional";
  error?: string;
  onSelect: (bottle: PickedBottle | null) => void;
};

export function TargetBottleChip({ name }: { name: string }) {
  return <p className="form-target-chip">対象：{name}</p>;
}

export function BottlePickerRow({
  bottleId,
  bottleName,
  label = "ボトル",
  hint,
  emptyValue = "選ぶ",
  valueLabel,
  clearable = false,
  requireSearch = false,
  placement = "field",
  error,
  onSelect,
}: BottlePickerRowProps) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const [q, setQ] = useState("");
  const qDebounced = useDebounced(q.trim(), 300);
  const searched = qDebounced.length > 0;
  const list = useBottles(
    { view: "all", ...(searched ? { q: qDebounced } : {}) },
    pickerBottlesQueryEnabled(open, qDebounced, requireSearch),
  );

  const optional = placement === "optional";
  const displayName = valueLabel ?? bottleName;

  return (
    <section className={optional ? "bottle-link-section" : "log-form-section"}>
      {optional ? null : <FieldLabel>{label}</FieldLabel>}
      {optional || !hint ? null : <p className="field-hint">{hint}</p>}
      {optional && !bottleId ? (
        <button type="button" className="bottle-link-row" onClick={() => setOpen(true)}>
          セラーのボトルと関連付ける（任意）
        </button>
      ) : null}
      {optional && bottleId ? (
        <div className="bottle-link-selected">
          <span className="bottle-link-name">{displayName ?? "ボトル"}</span>
          <button type="button" className="bottle-link-action" onClick={() => setOpen(true)}>
            変更
          </button>
          <button type="button" className="bottle-link-action" onClick={() => onSelect(null)}>
            解除
          </button>
        </div>
      ) : null}
      {optional ? null : (
        <div className="form-row">
          <button type="button" className="form-row-hit" onClick={() => setOpen(true)}>
            <span className="form-row-value form-row-value-start">{displayName ?? emptyValue}</span>
            <ChevronRight size={20} className="form-row-chevron" aria-hidden />
          </button>
          {clearable && bottleId ? (
            <button
              type="button"
              className="form-row-clear"
              aria-label="ボトルを解除"
              onClick={() => onSelect(null)}
            >
              <X size={18} aria-hidden />
            </button>
          ) : null}
        </div>
      )}
      {error ? (
        <p className="field-error" role="alert">
          {error}
        </p>
      ) : null}
      <DialogRoot
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) {
            setQ("");
          }
        }}
      >
        <DialogContent
          ref={panelRef}
          className="bottle-picker-panel"
          onOpenAutoFocus={(event) => {
            // 検索欄へ自動フォーカスするとキーボードが即座に開いて一覧が隠れる。
            // まず一覧から選べるようにパネル自体へフォーカスし、検索は任意でタップさせる
            event.preventDefault();
            panelRef.current?.focus();
          }}
        >
          <DialogTitle>ボトル</DialogTitle>
          <DialogDescription className="visually-hidden">セラーと貯蔵庫から選ぶ</DialogDescription>
          <Input
            aria-label="ボトルを検索"
            value={q}
            maxLength={100}
            placeholder="品名・生産者・品種"
            onChange={(event) => setQ(event.target.value)}
          />
          <button
            type="button"
            className="bottle-picker-none"
            onClick={() => {
              onSelect(null);
              setOpen(false);
              setQ("");
            }}
          >
            なし
          </button>
          {list.isError ? <p className="bottle-picker-error">読み込めませんでした</p> : null}
          {requireSearch && !searched ? <p className="bottle-picker-empty">品名で検索</p> : null}
          {list.isSuccess && list.data.items.length === 0 ? (
            <p className="bottle-picker-empty">該当するボトルがありません</p>
          ) : null}
          <ul className="bottle-picker-list">
            {(list.data?.items ?? []).map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className={pickerRowClassName(item.id === bottleId, item.status === "consumed")}
                  onClick={() => {
                    onSelect({
                      id: item.id,
                      name: item.name,
                      drinkType: item.drinkType,
                      status: item.status,
                      vintage: item.vintage,
                      producer: item.producer,
                      origin: item.origin,
                      variety: item.variety,
                      thumbPhotoId: item.thumbPhotoId,
                    });
                    setOpen(false);
                    setQ("");
                  }}
                >
                  {item.thumbPhotoId ? (
                    <ContentPhoto
                      className="bottle-picker-thumb"
                      src={photoContentUrl(item.thumbPhotoId)}
                      size={PHOTO_DISPLAY_SIZE.bottlePicker}
                    />
                  ) : (
                    <span className="bottle-picker-thumb is-empty" aria-hidden />
                  )}
                  <span className="bottle-picker-copy">
                    <strong>{item.name}</strong>
                    <span>
                      {[
                        DRINK_TYPE_LABELS[item.drinkType],
                        vintageLabel(item.vintage),
                        item.status === "consumed" ? "貯蔵庫" : null,
                      ]
                        .filter((value): value is string => Boolean(value))
                        .join(" ・ ")}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </DialogContent>
      </DialogRoot>
    </section>
  );
}

export function usePrefillBottle(
  bottleId: string | null | undefined,
  onSelect: BottlePickerRowProps["onSelect"],
  onMissing: () => void,
) {
  const query = useBottle(bottleId ?? undefined);
  const applied = useRef(false);
  useEffect(() => {
    if (!bottleId || applied.current) {
      return;
    }
    if (query.data) {
      applied.current = true;
      onSelect({
        id: query.data.id,
        name: query.data.name,
        drinkType: query.data.drinkType,
        status: query.data.status,
        vintage: query.data.vintage,
        producer: query.data.producer,
        origin: query.data.origin,
        variety: query.data.variety,
        thumbPhotoId: query.data.thumbPhotoId,
      });
    }
    if (query.isError) {
      applied.current = true;
      onMissing();
    }
  }, [bottleId, onMissing, onSelect, query.data, query.isError]);
}
