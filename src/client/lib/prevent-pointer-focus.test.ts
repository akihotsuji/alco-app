import { describe, expect, it, vi } from "vitest";
import { preventPointerFocus } from "./prevent-pointer-focus.ts";

describe("preventPointerFocus", () => {
  it("preventDefault を呼び、ポインタ由来のフォーカスを止める", () => {
    const event = { preventDefault: vi.fn() };
    preventPointerFocus(event);
    expect(event.preventDefault).toHaveBeenCalledOnce();
  });
});
