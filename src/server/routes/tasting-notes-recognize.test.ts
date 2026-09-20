import { describe, expect, it } from "vitest";
import { makeJpeg } from "../image-fixtures.ts";
import { createTestApp, createTestUser } from "../test-helpers.ts";

describe("POST /api/tasting-notes/recognize", () => {
  it("単独認識 API は置かない", async () => {
    const { app } = await createTestApp();
    const user = await createTestUser(app, {
      name: "a",
      email: "a@example.com",
      password: "password1",
    });
    const form = new FormData();
    form.set(
      "file",
      new File([Uint8Array.from(makeJpeg(320, 400))], "note.jpg", { type: "image/jpeg" }),
    );
    const res = await app.request("/api/tasting-notes/recognize", {
      method: "POST",
      headers: { Cookie: user.cookie },
      body: form,
    });
    expect(res.status).toBe(404);
  });
});
