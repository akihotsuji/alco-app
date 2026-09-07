/**
 * 写真の取り込み（07-photo-capture）。
 * 撮影とライブラリ選択は別経路。iOS の `capture` はライブラリを出さず、
 * Android の `capture` なしはカメラを出さない端末があるため、1 つの input に任せない。
 * `getUserMedia` は使わない。
 */

export type ImagePickSource = "camera" | "library";

export const IMAGE_PICK_LABELS = {
  library: "ライブラリから",
  noteLibrary: "選ぶ",
} as const;

export function imagePickAttributes(source: ImagePickSource): {
  accept: "image/*";
  capture: "environment" | null;
} {
  return {
    accept: "image/*",
    capture: source === "camera" ? "environment" : null,
  };
}

export function applyImagePickSource(input: HTMLInputElement, source: ImagePickSource): void {
  const attrs = imagePickAttributes(source);
  input.type = "file";
  input.accept = attrs.accept;
  if (attrs.capture) {
    input.setAttribute("capture", attrs.capture);
  } else {
    input.removeAttribute("capture");
  }
}

export function pickImage(source: ImagePickSource = "camera"): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    applyImagePickSource(input, source);
    input.hidden = true;
    document.body.appendChild(input);

    let settled = false;
    const finish = (file: File | null) => {
      if (settled) {
        return;
      }
      settled = true;
      window.removeEventListener("focus", onWindowFocus);
      input.remove();
      resolve(file);
    };

    const onWindowFocus = () => {
      window.setTimeout(() => {
        finish(input.files?.[0] ?? null);
      }, 400);
    };

    input.addEventListener("change", () => {
      finish(input.files?.[0] ?? null);
    });
    input.addEventListener("cancel", () => {
      finish(null);
    });
    window.addEventListener("focus", onWindowFocus);

    input.click();
  });
}
