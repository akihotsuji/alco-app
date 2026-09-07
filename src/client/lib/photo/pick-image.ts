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

function openFileInput(source: ImagePickSource, options: ImagePickOptions): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    applyImagePickSource(input, source, options);
    input.hidden = true;
    document.body.appendChild(input);

    let settled = false;
    const finish = (files: File[]) => {
      if (settled) {
        return;
      }
      settled = true;
      window.removeEventListener("focus", onWindowFocus);
      input.remove();
      resolve(files);
    };

    const onWindowFocus = () => {
      window.setTimeout(() => {
        finish(Array.from(input.files ?? []));
      }, 400);
    };

    input.addEventListener("change", () => {
      finish(Array.from(input.files ?? []));
    });
    input.addEventListener("cancel", () => {
      finish([]);
    });
    window.addEventListener("focus", onWindowFocus);

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
