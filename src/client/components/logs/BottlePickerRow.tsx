import { ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
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
import { DRINK_TYPE_LABELS, type DrinkType } from "@/shared/constants.ts";

function useDebounced(value: string, ms: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), ms);
    return () => window.clearTimeout(timer);
  }, [value, ms]);
  return debounced;
}

type PickedBottle = { id: string; name: string; drinkType: DrinkType };

type BottlePickerRowProps = {
  bottleId: string | null;
  bottleName: string | null;
  error?: string;
  onSelect: (bottle: PickedBottle | null) => void;
};

export function BottlePickerRow({ bottleId, bottleName, error, onSelect }: BottlePickerRowProps) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const qDebounced = useDebounced(q.trim(), 300);
  const list = useBottles({ view: "all", ...(qDebounced ? { q: qDebounced } : {}) });

  return (
    <section className="log-form-section">
      <button type="button" className="form-row" onClick={() => setOpen(true)}>
        <span className="form-row-label">ボトル</span>
        <span className="form-row-value">{bottleName ?? "選ぶ"}</span>
        <ChevronRight size={20} className="form-row-chevron" aria-hidden />
      </button>
      {error ? (
        <p className="field-error" role="alert">
          {error}
        </p>
      ) : null}
      <DialogRoot open={open} onOpenChange={setOpen}>
        <DialogContent className="bottle-picker-panel">
          <DialogTitle>ボトル</DialogTitle>
          <DialogDescription className="visually-hidden">セラーと貯蔵庫から選ぶ</DialogDescription>
          <Input
            aria-label="ボトルを検索"
            value={q}
            maxLength={100}
            placeholder="銘柄名・生産者"
            onChange={(event) => setQ(event.target.value)}
          />
          <button
            type="button"
            className="bottle-picker-none"
            onClick={() => {
              onSelect(null);
              setOpen(false);
            }}
          >
            なし
          </button>
          {list.isError ? <p className="bottle-picker-error">読み込めませんでした</p> : null}
          {list.isSuccess && list.data.items.length === 0 ? (
            <p className="bottle-picker-empty">該当するボトルがありません</p>
          ) : null}
          <ul className="bottle-picker-list">
            {(list.data?.items ?? []).map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className={item.id === bottleId ? "bottle-picker-row is-on" : "bottle-picker-row"}
                  onClick={() => {
                    onSelect({ id: item.id, name: item.name, drinkType: item.drinkType });
                    setOpen(false);
                  }}
                >
                  {item.thumbPhotoId ? (
                    <img className="bottle-picker-thumb" src={photoContentUrl(item.thumbPhotoId)} alt="" />
                  ) : (
                    <span className="bottle-picker-thumb is-empty" aria-hidden />
                  )}
                  <span className="bottle-picker-copy">
                    <strong>{item.name}</strong>
                    <span>
                      {DRINK_TYPE_LABELS[item.drinkType]} ・ {vintageLabel(item.vintage)}
                      {item.status === "consumed" ? " ・ 貯蔵庫" : ""}
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
      onSelect({ id: query.data.id, name: query.data.name, drinkType: query.data.drinkType });
    }
    if (query.isError) {
      applied.current = true;
      onMissing();
    }
  }, [bottleId, onMissing, onSelect, query.data, query.isError]);
}
