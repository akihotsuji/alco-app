/**
 * ソフトキーボードが覆っている高さ（px）を `<html style="--keyboard-inset">` に書く。
 * `position: fixed; bottom` の部品（ダイアログ）はこの変数ぶん持ち上げ、キーボードの上に出す。
 *
 * Android Chrome は viewport meta の `interactive-widget=resizes-content` でレイアウトビューポートごと縮むので 0 になる。
 * iOS Safari はレイアウトビューポートが縮まず visualViewport だけ小さくなるため、その差をここで補う。
 */
export const KEYBOARD_INSET_VAR = "--keyboard-inset";

/** レイアウトビューポート高と visualViewport の差。負やサブピクセルは 0 に丸める */
export function keyboardInsetPx(
  layoutHeight: number,
  visualHeight: number,
  visualOffsetTop: number,
): number {
  const inset = Math.round(layoutHeight - visualHeight - visualOffsetTop);
  return inset > 0 ? inset : 0;
}

export function installKeyboardInset(): () => void {
  const viewport = window.visualViewport;
  if (!viewport) {
    return () => {};
  }
  const html = document.documentElement;
  const update = () => {
    const inset = keyboardInsetPx(window.innerHeight, viewport.height, viewport.offsetTop);
    html.style.setProperty(KEYBOARD_INSET_VAR, `${inset}px`);
  };
  viewport.addEventListener("resize", update);
  viewport.addEventListener("scroll", update);
  update();
  return () => {
    viewport.removeEventListener("resize", update);
    viewport.removeEventListener("scroll", update);
    html.style.removeProperty(KEYBOARD_INSET_VAR);
  };
}
