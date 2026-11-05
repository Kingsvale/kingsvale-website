import { describe, expect, it } from "vitest";
import { lookupPublicLocalTrackingSite, normalizePublicTrackingSite } from "./trackingLocalRead";
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

  it("can search local records that predate the reference and structured address fields", () => {
    window.localStorage.setItem("kingsvale-tracking-sites-v1", JSON.stringify([
      null, { siteAddress: "Legacy freeform address" },
      { reference: "KV-OLD", siteAddress: "5 Brailsford Road, London, SW2 2TB" }
    ]));
    expect(lookupPublicLocalTrackingSite("KV-OLD", "SW2 2TB")?.siteAddress).toBe("5 Brailsford Road, London, SW2 2TB");
  });

  it("hides correspondence fields on the QR response while lookup still uses the letter postcode", () => {
    const site = {
      id: "separate-address", reference: "KV0114", token: "abcdefghijklmnopqrstuvwx",
      siteAddress: "5 Brailsford Road, London, SW2 2TB",
      siteAddressParts: { line1: "5 Brailsford Road", line2: "", town: "London", county: "", postcode: "SW2 2TB" },
      landAddress: "Land adjacent to 5, Newnham Lane, Old Basing, RG24 7AT"
    };
    window.localStorage.setItem("kingsvale-tracking-sites-v1", JSON.stringify([site]));
    const result = lookupPublicLocalTrackingSite(" kv0114 ", "sw22tb");
    expect(result?.siteAddress).toBe(site.landAddress);
    expect(result?.siteAddressParts.postcode).toBe("RG24 7AT");
    expect(JSON.stringify(result)).not.toContain("Brailsford");
    expect(JSON.stringify(result)).not.toContain("SW2 2TB");
    expect(lookupPublicLocalTrackingSite("KV0114", "RG24 7AT")).toBeNull();
  });
});
