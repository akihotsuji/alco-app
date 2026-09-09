import { describe, expect, it } from "vitest";
import { extractGroundingSources } from "./usage.ts";

describe("extractGroundingSources", () => {
  it("https の grounding だけ残し、javascript と http は捨てる", () => {
    const sources = extractGroundingSources({
      candidates: [
        {
          groundingMetadata: {
            groundingChunks: [
              { web: { uri: "https://winery.test/sheet", title: "Sheet" } },
              { web: { uri: "http://winery.test/insecure" } },
              { web: { uri: "javascript:alert(1)" } },
            ],
          },
        },
      ],
    });
    expect(sources).toEqual([{ url: "https://winery.test/sheet", title: "Sheet" }]);
  });
});
