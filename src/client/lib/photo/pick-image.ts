/**
 * 写真を 1 枚選ぶ（07-photo-capture 方針）。`capture` 属性は付けず、OS の選択 UI で
 * 「カメラで撮る」「保存済みの写真から選ぶ」のどちらも選べるようにする（Issue #55）。
 * `getUserMedia` は使わない。
 */
export function pickImage(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
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
