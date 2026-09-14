import { afterEach, describe, expect, it, vi } from "vitest";
import { defaultContent } from "../data/defaultContent";
import { parseBackup } from "./backupValidation";
import type { KingsvaleBackup } from "./cmsApi";

const backup: KingsvaleBackup = { kind: "kingsvale-full-backup", version: 2, exportedAt: new Date().toISOString(), media: [], stores: {
  cms: { published: defaultContent, draft: defaultContent, revisions: [] }, tracking: { sites: [], updatedAt: null }, analytics: { visits: [] }, leads: { contact: "", newsletter: "" }
} };

afterEach(() => { vi.unstubAllGlobals(); window.sessionStorage.clear(); });

async function serverApi() {
  vi.resetModules();
  window.sessionStorage.setItem("kingsvale-studio-auth-token-v1", JSON.stringify({ token: "test-server-session", expiresAt: new Date(Date.now() + 3600000).toISOString() }));
  return import("./cmsApi");
}

describe("Image and backup persistence", () => {
  it("never converts a failed server upload to a browser data URL", async () => {
    const api = await serverApi();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Offline")));
    await expect(api.uploadCmsImage(new File(["photo"], "garden.png", { type: "image/png" }))).rejects.toThrow("could not reach the server");
  });
  it("does not export local content when the server backup fails", async () => {
    const api = await serverApi();
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "Disk unavailable" }), { status: 500, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetch);
    await expect(api.exportFullBackup()).rejects.toThrow("Disk unavailable");
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("does not import into the browser when the server rejects media", async () => {
    const api = await serverApi();
    const fetch = vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "Media integrity check failed" }), { status: 400, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetch);
    await expect(api.importFullBackup(backup, "replace")).rejects.toThrow("Media integrity check failed");
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(window.localStorage.length).toBe(0);
  });
  it("rejects malformed backup summaries before the panel can use them", () => {
    expect(() => parseBackup({ kind: "kingsvale-full-backup", version: 2 })).toThrow("incomplete");
    expect(() => parseBackup({ ...backup, media: undefined })).toThrow("uploaded files");
    expect(parseBackup(backup).media).toEqual([]);
  });
});
