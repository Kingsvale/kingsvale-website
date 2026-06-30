import { describe, expect, it } from "vitest";
import { normalizePublicTrackingSite } from "./trackingLocalRead";
import type { TrackingSite } from "./trackingTypes";

describe("public local tracking normalization", () => {
  it("matches the server public contract by stripping admin-only fields", () => {
    const publicSite = normalizePublicTrackingSite({
      id: "site-1",
      token: "public-token",
      title: "Public title",
      customerName: "Visible customer",
      siteAddress: "1 Plot Road, Town, AB1 2CD",
      siteAddressParts: { line1: "1 Plot Road", line2: "", town: "Town", county: "", postcode: "ab1 2cd" },
      statusNote: "Visible status",
      privateNotes: "Internal note",
      ownerAddress: "Private owner address",
      titleNumber: "PRIVATE123",
      searchlandUrl: "https://app.searchland.co.uk/private",
      royalMailTrackingNumber: "AA123456789GB",
      letterFileUrl: "/media/private-letter.docx",
      mailingNotes: "Private mailing notes",
      archived: false
    } as Partial<TrackingSite>) as unknown as Record<string, unknown>;

    expect(publicSite.title).toBe("Public title");
    expect(publicSite.siteAddressParts).toEqual({
      line1: "1 Plot Road",
      line2: "",
      town: "Town",
      county: "",
      postcode: "AB1 2CD"
    });
    expect(publicSite.privateNotes).toBeUndefined();
    expect(publicSite.ownerAddress).toBeUndefined();
    expect(publicSite.titleNumber).toBeUndefined();
    expect(publicSite.searchlandUrl).toBeUndefined();
    expect(publicSite.royalMailTrackingNumber).toBeUndefined();
    expect(publicSite.letterFileUrl).toBeUndefined();
    expect(publicSite.mailingNotes).toBeUndefined();
  });

  it("keeps a stable address-parts object for legacy local records", () => {
    expect(normalizePublicTrackingSite({ siteAddress: "Legacy freeform address" } as TrackingSite).siteAddressParts)
      .toEqual({ line1: "", line2: "", town: "", county: "", postcode: "" });
  });
});
