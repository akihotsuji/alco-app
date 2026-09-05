export type PickImageOptions = {
  capture?: boolean;
};

export function pickImage(options: PickImageOptions = {}): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    if (options.capture !== false) {
      input.setAttribute("capture", "environment");
    }
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
