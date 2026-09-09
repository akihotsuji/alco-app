/** 認証後シェルの縦スクロール契約。正本は spec/screen-designs/00-common.md 1.3 */

export type ScrollBox = {
  scrollHeight: number;
  clientHeight: number;
  scrollTop: number;
};

export function canScrollBox(box: ScrollBox, epsilon = 1): boolean {
  return box.scrollHeight > box.clientHeight + epsilon;
}

/** 長いページで動くべきなのは .app-content。document に逃げていると PWA 再起動後に指が死ぬ */
export function primaryScrollerKind(input: {
  content: ScrollBox | null;
  document: ScrollBox;
}): "content" | "document" | "none" {
  if (input.content && canScrollBox(input.content)) {
    return "content";
  }
  if (canScrollBox(input.document)) {
    return "document";
  }
  return "none";
}
