import { afterEach, describe, expect, it, vi } from "vitest";
import { defaultContent } from "../data/defaultContent";
import { fetchServerContent } from "./serverContent";

describe("fetchServerContent", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns validated server content", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ content: defaultContent })
      })
    );

    await expect(fetchServerContent()).resolves.toEqual(defaultContent);
  });

  it("returns null when the server has no published content", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ content: null })
      })
    );

    await expect(fetchServerContent()).resolves.toBeNull();
  });

  it("returns null when the endpoint is unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    await expect(fetchServerContent()).resolves.toBeNull();
  });
});
