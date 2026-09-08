import { describe, expect, it } from "vitest";
import {
  addBootPrefetchInput,
  BOOT_PREFETCH_DEV_SRC,
  BOOT_PREFETCH_ENTRY,
  injectBootPrefetchScript,
  stripBootPrefetchScript,
} from "../../../vite.boot-prefetch.ts";

describe("alcoBootPrefetch", () => {
  it("既存の HTML 入力に bootPrefetch エントリを足す", () => {
    expect(addBootPrefetchInput("index.html", "/abs/boot-prefetch.ts")).toEqual({
      main: "index.html",
      [BOOT_PREFETCH_ENTRY]: "/abs/boot-prefetch.ts",
    });
    expect(addBootPrefetchInput(["index.html"], "/abs/boot-prefetch.ts")).toEqual([
      "index.html",
      "/abs/boot-prefetch.ts",
    ]);
    expect(addBootPrefetchInput({ main: "index.html" }, "/abs/boot-prefetch.ts")).toEqual({
      main: "index.html",
      [BOOT_PREFETCH_ENTRY]: "/abs/boot-prefetch.ts",
    });
  });

  it("本番 HTML では開発用 script を外し、ハッシュ付きを main より前に入れる", () => {
    const source = `<body>
    <div id="root"></div>
    <script type="module" src="${BOOT_PREFETCH_DEV_SRC}"></script>
    <script type="module" src="/src/client/main.tsx"></script>
  </body>`;
    const stripped = stripBootPrefetchScript(source);
    expect(stripped).not.toContain(BOOT_PREFETCH_DEV_SRC);
    expect(stripped).toContain("/src/client/main.tsx");
    const injected = injectBootPrefetchScript(stripped, "assets/bootPrefetch-abc.js");
    expect(injected.indexOf("assets/bootPrefetch-abc.js")).toBeLessThan(
      injected.indexOf("/src/client/main.tsx"),
    );
    expect(injectBootPrefetchScript(injected, "assets/bootPrefetch-abc.js")).toBe(injected);
  });
});
