/** ダイアログが開いているときだけ取る。ノートは検索必須（全件ロードしない）。 */
export function pickerBottlesQueryEnabled(
  open: boolean,
  query: string,
  requireSearch: boolean,
): boolean {
  if (!open) {
    return false;
  }
  if (!requireSearch) {
    return true;
  }
  return query.trim().length > 0;
}

export type PickerGroup<T> = {
  key: "opened" | "sealed" | "consumed";
  label: string;
  items: T[];
};

const PICKER_GROUP_LABELS = {
  opened: "味わい中",
  sealed: "セラー",
  consumed: "貯蔵庫",
} as const;

/**
 * 記録のボトル選択（03-log N8。bottle-tasting.md 4 章）。味わい中 → セラー → 貯蔵庫。
 * 味わい中は別に取った一覧を先頭に置き、全体の一覧からは重ねない（取得件数の外に落ちないように）
 */
export function groupPickerBottles<T extends { id: string; status: string }>(
  opened: readonly T[],
  all: readonly T[],
): PickerGroup<T>[] {
  const openedIds = new Set(opened.map((item) => item.id));
  const rest = all.filter((item) => !openedIds.has(item.id));
  const groups: PickerGroup<T>[] = [
    {
      key: "opened",
      label: PICKER_GROUP_LABELS.opened,
      items: [...opened, ...rest.filter((item) => item.status === "opened")],
    },
    {
      key: "sealed",
      label: PICKER_GROUP_LABELS.sealed,
      items: rest.filter((item) => item.status === "sealed"),
    },
    {
      key: "consumed",
      label: PICKER_GROUP_LABELS.consumed,
      items: rest.filter((item) => item.status === "consumed"),
    },
  ];
  return groups.filter((group) => group.items.length > 0);
}

export function pickerRowClassName(selected: boolean, consumed: boolean): string {
  const classes = ["bottle-picker-row"];
  if (selected) {
    classes.push("is-on");
  }
  if (consumed) {
    classes.push("is-consumed");
  }
  return classes.join(" ");
}
