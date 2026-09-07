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
