/**
 * 写真の取り込み（07-photo-capture）。
 * 撮影とライブラリ選択は別経路。iOS の `capture` はライブラリを出さず、
 * Android の `capture` なしはカメラを出さない端末があるため、1 つの input に任せない。
 * `getUserMedia` は使わない。
 */

export type ImagePickSource = "camera" | "library";

export const IMAGE_PICK_LABELS = {
  library: "ライブラリから",
  libraryMultiple: "ライブラリから（複数枚）",
  noteLibrary: "選ぶ",
  capture: "写真を撮る",
  captureLibrary: "写真を選ぶ",
} as const;

export type ImagePickOptions = {
  /** ライブラリのみ。撮影は OS が 1 枚に制限する端末が多いので付けない */
  multiple?: boolean;
};

export function imagePickAttributes(
  source: ImagePickSource,
  options: ImagePickOptions = {},
): {
  accept: "image/*";
  capture: "environment" | null;
  multiple: boolean;
} {
  return {
    accept: "image/*",
    capture: source === "camera" ? "environment" : null,
    multiple: source === "library" && options.multiple === true,
  };
}

export function applyImagePickSource(
  input: HTMLInputElement,
  source: ImagePickSource,
  options: ImagePickOptions = {},
): void {
  const attrs = imagePickAttributes(source, options);
  input.type = "file";
  input.accept = attrs.accept;
  if (attrs.capture) {
    input.setAttribute("capture", attrs.capture);
  } else {
    input.removeAttribute("capture");
  }
  input.multiple = attrs.multiple;
}

/** iOS はカメラ／ライブラリ復帰後、`change` より先に focus が来て files が空のことがある */
export const IMAGE_PICK_FOCUS_GRACE_MS = 2500;
export const IMAGE_PICK_POLL_INTERVAL_MS = 150;

export function filesFromList(list: FileList | null | undefined): File[] {
  return Array.from(list ?? []);
}

/**
 * focus 復帰直後は空でも待って、遅れて入った File を取る。
 * 猶予を過ぎて空ならキャンセル。
 */
export function resolvePickedFilesAfterFocus(
  files: readonly File[],
  elapsedMs: number,
  graceMs = IMAGE_PICK_FOCUS_GRACE_MS,
): "selected" | "cancel" | "wait" {
  if (files.length > 0) {
    return "selected";
  }
  return elapsedMs >= graceMs ? "cancel" : "wait";
}

function placeOffscreenFileInput(input: HTMLInputElement): void {
  // iOS は `hidden` だと change が欠ける端末があるので、画面外に置く
  input.style.position = "fixed";
  input.style.left = "0";
  input.style.top = "0";
  input.style.width = "1px";
  input.style.height = "1px";
  input.style.opacity = "0";
  input.style.pointerEvents = "none";
}

function openFileInput(source: ImagePickSource, options: ImagePickOptions): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    applyImagePickSource(input, source, options);
    placeOffscreenFileInput(input);
    document.body.appendChild(input);

    let settled = false;
    let leftPage = false;
    let pollTimer = 0;
    const finish = (files: File[]) => {
      if (settled) {
        return;
      }
      settled = true;
      window.clearTimeout(pollTimer);
      window.removeEventListener("blur", markLeft);
      window.removeEventListener("focus", onReturn);
      document.removeEventListener("visibilitychange", onVisibility);
      input.remove();
      resolve(files);
    };

    const markLeft = () => {
      leftPage = true;
    };

    const watchForDelayedFiles = () => {
      if (settled) {
        return;
      }
      const started = Date.now();
      const tick = () => {
        if (settled) {
          return;
        }
        const files = filesFromList(input.files);
        const decision = resolvePickedFilesAfterFocus(files, Date.now() - started);
        if (decision === "selected") {
          finish(files);
          return;
        }
        if (decision === "cancel") {
          finish([]);
          return;
        }
        pollTimer = window.setTimeout(tick, IMAGE_PICK_POLL_INTERVAL_MS);
      };
      window.clearTimeout(pollTimer);
      pollTimer = window.setTimeout(tick, IMAGE_PICK_POLL_INTERVAL_MS);
    };

    const onReturn = () => {
      // 撮影 UI を開いた直後の focus では走らせない（input を消して写真を捨てる）
      if (leftPage) {
        watchForDelayedFiles();
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        markLeft();
        return;
      }
      onReturn();
    };

    input.addEventListener("change", () => {
      finish(filesFromList(input.files));
    });
    input.addEventListener("cancel", () => {
      finish([]);
    });
    window.addEventListener("blur", markLeft);
    window.addEventListener("focus", onReturn);
    document.addEventListener("visibilitychange", onVisibility);

    input.click();
  });
}

export function pickImages(
  source: ImagePickSource = "camera",
  options: ImagePickOptions = {},
): Promise<File[]> {
  return openFileInput(source, options);
}

export function pickImage(source: ImagePickSource = "camera"): Promise<File | null> {
  return pickImages(source).then((files) => files[0] ?? null);
}
