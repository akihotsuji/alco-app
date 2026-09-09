import { describe, expect, it } from "vitest";
import { ciSucceededOnCommit } from "@/ci/require-ci-success.ts";

describe("ciSucceededOnCommit", () => {
  it("accepts a successful CI workflow run", () => {
    expect(
      ciSucceededOnCommit({
        workflow_runs: [
          { name: "Deploy dev", conclusion: "success" },
          { name: "CI", conclusion: "success" },
        ],
      }),
    ).toBe(true);
  });

  it("rejects missing, failed, or non-CI runs", () => {
    expect(ciSucceededOnCommit(null)).toBe(false);
    expect(ciSucceededOnCommit({})).toBe(false);
    expect(ciSucceededOnCommit({ workflow_runs: [{ name: "CI", conclusion: "failure" }] })).toBe(
      false,
    );
    expect(
      ciSucceededOnCommit({ workflow_runs: [{ name: "Deploy prod", conclusion: "success" }] }),
    ).toBe(false);
  });
});
