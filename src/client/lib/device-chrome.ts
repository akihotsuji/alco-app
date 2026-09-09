/**
 * 端末枠（6-05）。セーフエリアとシェル class の契約。
 * 値の正本は spec/qa-devices.md と styles.css の `--safe-*`。
 */

export type SafeAreaInsets = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

export const ZERO_SAFE_AREA: SafeAreaInsets = {
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
};

export function parseCssPx(value: string): number {
  const parsed = Number.parseFloat(value.trim());
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

export function readSafeAreaInsets(style: {
  getPropertyValue: (name: string) => string;
}): SafeAreaInsets {
  return {
    top: parseCssPx(style.getPropertyValue("--safe-top")),
    right: parseCssPx(style.getPropertyValue("--safe-right")),
    bottom: parseCssPx(style.getPropertyValue("--safe-bottom")),
    left: parseCssPx(style.getPropertyValue("--safe-left")),
  };
}

/**
 * カスタムプロパティの指定値（`env(...)`）は px にならない。
 * padding に env を載せたプローブの計算値を読む。
 */
export function measureSafeAreaInsets(): SafeAreaInsets {
  if (typeof document === "undefined") {
    return ZERO_SAFE_AREA;
  }
  const host = document.documentElement;
  let probe = host.querySelector<HTMLDivElement>("[data-safe-area-probe='1']");
  if (!probe) {
    probe = document.createElement("div");
    probe.dataset.safeAreaProbe = "1";
    probe.setAttribute("aria-hidden", "true");
    probe.style.cssText =
      "position:fixed;top:0;left:0;width:0;height:0;overflow:hidden;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px)";
    host.appendChild(probe);
  }
  const style = getComputedStyle(probe);
  return {
    top: parseCssPx(style.paddingTop),
    right: parseCssPx(style.paddingRight),
    bottom: parseCssPx(style.paddingBottom),
    left: parseCssPx(style.paddingLeft),
  };
}

export function appShellClassName(input: { hideTabs: boolean; hideHeader: boolean }): string {
  const classes = ["app-shell"];
  if (input.hideTabs) {
    classes.push("app-shell-no-tabs");
  }
  if (input.hideHeader) {
    classes.push("app-shell-no-header");
  }
  return classes.join(" ");
}
