import { describe, expect, it } from "vitest";
import { studioRoute } from "./studioRoute";
import { verifyStudioPassphrase } from "./studioSecurity";

describe("studio security", () => {
  it("uses a 16-character generated studio route", () => {
    expect(studioRoute).toMatch(/^[a-f0-9]{16}$/);
  });

  it("verifies the configured passphrase without storing plaintext", async () => {
    await expect(verifyStudioPassphrase("KV-3D0pKUxlx2yC")).resolves.toBe(true);
    await expect(verifyStudioPassphrase("incorrect")).resolves.toBe(false);
  });
});
