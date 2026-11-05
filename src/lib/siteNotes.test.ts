import { describe, expect, it } from "vitest";
import { sharedSiteNotes } from "./siteNotes.js";
import { normalizeTrackingSite } from "./trackingNormalize";
import { createTrackingSite, loadLocalTrackingSites, trackingStorageKey, upsertLocalTrackingSite } from "./trackingStorage";
import { validateTrackingSite } from "./trackingValidation";

describe("shared site notes", () => {
  it.each([
    ["", "", ""],
    ["Site note", "", "Site note"],
    ["", "Mailing note", "Mailing note"],
    ["Same note", "Same note", "Same note"],
    ["Site note", "Mailing note", "Site note\n\nMailing note"]
  ])("preserves legacy notes (%s / %s)", (privateNotes, mailingNotes, expected) => {
    const normalized = normalizeTrackingSite({ ...createTrackingSite(), privateNotes, mailingNotes });
    expect(normalized.privateNotes).toBe(expected);
    expect(normalized.mailingNotes).toBe(expected);
    expect(normalizeTrackingSite(normalized)).toEqual(normalized);
  });

  it("keeps two maximum-length legacy notes editable", () => {
    const site = normalizeTrackingSite({ ...createTrackingSite(), privateNotes: "S".repeat(1200), mailingNotes: "M".repeat(1200) });
    expect(site.privateNotes).toHaveLength(2402);
    expect(validateTrackingSite(site).valid).toBe(true);
  });

  it("accepts edits and clearing through either legacy alias", () => {
    const previous = { privateNotes: "Original", mailingNotes: "Original" };
    for (const field of ["privateNotes", "mailingNotes"] as const) {
      for (const value of ["Changed", ""]) {
        expect(sharedSiteNotes({ ...previous, [field]: value }, previous)).toEqual({ privateNotes: value, mailingNotes: value });
      }
    }
  });

  it("rejects invalid note types", () => {
    const site = normalizeTrackingSite({ ...createTrackingSite(), privateNotes: 123 as unknown as string });
    expect(site.privateNotes).toBe(123);
    expect(validateTrackingSite(site).valid).toBe(false);
  });

  it("shares and clears notes in browser storage after migration", () => {
    const legacy = { ...createTrackingSite(), privateNotes: "Site note", mailingNotes: "Mailing note" };
    localStorage.setItem(trackingStorageKey, JSON.stringify([legacy]));
    try {
      const loaded = loadLocalTrackingSites()[0];
      expect(loaded.privateNotes).toBe("Site note\n\nMailing note");
      const edited = upsertLocalTrackingSite({ ...loaded, mailingNotes: "Call next week" });
      expect(edited.privateNotes).toBe("Call next week");
      const cleared = upsertLocalTrackingSite({ ...edited, privateNotes: "" });
      expect(cleared.mailingNotes).toBe("");
      expect(loadLocalTrackingSites()[0].privateNotes).toBe("");
    } finally {
      localStorage.removeItem(trackingStorageKey);
    }
  });
});
