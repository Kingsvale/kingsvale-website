import { describe, expect, it } from "vitest";
import { studioRoute } from "./studioRoute";
import { verifyStudioPassphrase } from "./studioSecurity";

describe("studio security", () => {
  it("uses the dedicated studio route", () => {
    expect(studioRoute).toBe("studio");
  });

  it("verifies the configured passphrase without storing plaintext", async () => {
    await expect(verifyStudioPassphrase("KV-3D0pKUxlx2yC")).resolves.toBe(true);
    await expect(verifyStudioPassphrase("incorrect")).resolves.toBe(false);
  });
});
