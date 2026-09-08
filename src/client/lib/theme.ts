import { getThemePref, PREF_CHANGE_EVENT, parseThemePref } from "@/client/lib/preferences.ts";
import { type ResolvedTheme, type ThemePref, UI_PREF_KEYS } from "@/shared/constants.ts";
import { PWA_THEME_COLOR_DARK, PWA_THEME_COLOR_LIGHT } from "@/shared/pwa.ts";

export const THEME_ATTR = "data-theme";
export const DARK_SCHEME_QUERY = "(prefers-color-scheme: dark)";

/** 設定「外観」と OS の外観設定から、`<html data-theme>` に入れる値を決める（06-settings S10） */
export function resolveTheme(pref: ThemePref, osDark: boolean): ResolvedTheme {
  if (pref === "system") {
    return osDark ? "dark" : "light";
  }
  return pref;
}

function osPrefersDark(): boolean {
  return typeof matchMedia === "function" && matchMedia(DARK_SCHEME_QUERY).matches;
}

export function themeColorFor(theme: ResolvedTheme): string {
  return theme === "dark" ? PWA_THEME_COLOR_DARK : PWA_THEME_COLOR_LIGHT;
}

/** 設定「外観」で解決した色を、OS の prefers-color-scheme より優先して theme-color に書く */
export function applyThemeColor(
  doc: Pick<Document, "head" | "createElement"> & { querySelector: Document["querySelector"] },
  theme: ResolvedTheme,
): void {
  if (!doc.head) {
    return;
  }
  let meta = doc.querySelector("meta[name='theme-color'][data-resolved='1']");
  if (!meta) {
    meta = doc.createElement("meta");
    meta.setAttribute("name", "theme-color");
    meta.setAttribute("data-resolved", "1");
    doc.head.appendChild(meta);
  }
  meta.setAttribute("content", themeColorFor(theme));
}

export function applyTheme(html: HTMLElement, pref: ThemePref, osDark: boolean): ResolvedTheme {
  const theme = resolveTheme(pref, osDark);
  html.setAttribute(THEME_ATTR, theme);
  const doc = html.ownerDocument;
  if (doc) {
    applyThemeColor(doc, theme);
  }
  return theme;
}

/**
 * 起動時に 1 回呼び、以後は設定変更（同一タブは PREF_CHANGE_EVENT、別タブは storage）と
 * OS の外観変更に追従して `<html data-theme>` を更新する。CSS のトークンはこの属性だけを見る。
 * 属性が付く前の初回描画は styles.css の `prefers-color-scheme` フォールバックが受け持つ。
 */
export function installTheme(): () => void {
  const html = document.documentElement;
  const query = typeof matchMedia === "function" ? matchMedia(DARK_SCHEME_QUERY) : null;
  const update = () => {
    applyTheme(html, getThemePref(), query?.matches ?? osPrefersDark());
  };
  const onStorage = (event: StorageEvent) => {
    if (event.key === UI_PREF_KEYS.theme) {
      applyTheme(html, parseThemePref(event.newValue), query?.matches ?? false);
    }
  };
  update();
  query?.addEventListener("change", update);
  window.addEventListener(PREF_CHANGE_EVENT, update);
  window.addEventListener("storage", onStorage);
  return () => {
    query?.removeEventListener("change", update);
    window.removeEventListener(PREF_CHANGE_EVENT, update);
    window.removeEventListener("storage", onStorage);
    html.removeAttribute(THEME_ATTR);
  };
}
