/**
 * ポインタ操作でコントロールへフォーカスさせない。
 * native の radio / checkbox にフォーカスすると、モバイルブラウザが IME 回避で
 * visualViewport や safe-area-inset-bottom を変え、固定タブが伸びて下半分を覆う。
 * クリック（選択）自体は preventDefault しても残る。キーボードの Tab は対象外。
 */
export function preventPointerFocus(event: { preventDefault: () => void }): void {
  event.preventDefault();
}
