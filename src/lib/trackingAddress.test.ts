import { describe, expect, it } from "vitest";
import { parseTrackingAddress, publicTrackingAddress } from "./trackingAddress.js";
import { normalizeTrackingSite } from "./trackingNormalize";
import { createTrackingSite } from "./trackingStorage";
import { validateTrackingSite } from "./trackingValidation";

describe("pasted tracking addresses", () => {
  it("splits the supplied land address without inventing a county", () => {
    expect(parseTrackingAddress("LAND ADJACENT TO 5, NEWNHAM LANE, OLD BASING, RG24 7AT")).toEqual({
      line1: "LAND ADJACENT TO 5", line2: "NEWNHAM LANE", town: "OLD BASING", county: "", postcode: "RG24 7AT"
    });
  });

  it.each([
    ["72 Pardown, Oakley, Hampshire, rg237dz", { line1: "72 Pardown", line2: "", town: "Oakley", county: "Hampshire", postcode: "RG23 7DZ" }],
    ["Flat 2\r\nOak House\r\n5 High Street\r\nReading\r\nBerkshire\r\nRG1 1AA\r\nUnited Kingdom", { line1: "Flat 2", line2: "Oak House, 5 High Street", town: "Reading", county: "Berkshire", postcode: "RG1 1AA" }],
    ["Flat 2, Oak House, High Street, Old Basing, RG24 7AT", { line1: "Flat 2", line2: "Oak House, High Street", town: "Old Basing", county: "", postcode: "RG24 7AT" }],
    ["5 Brailsford Road, London, SW2 2TB", { line1: "5 Brailsford Road", line2: "", town: "London", county: "", postcode: "SW2 2TB" }],
    ["5 Brailsford Road, Brixton, London, SW2 2TB", { line1: "5 Brailsford Road", line2: "Brixton", town: "London", county: "", postcode: "SW2 2TB" }],
    ["Land off Newnham Lane", { line1: "Land off Newnham Lane", line2: "", town: "", county: "", postcode: "" }],
    ["", { line1: "", line2: "", town: "", county: "", postcode: "" }]
  ])("preserves the supplied components in %s", (input, expected) => {
    expect(parseTrackingAddress(input)).toEqual(expected);
  });
});

describe("land and letter address separation", () => {
  it("defaults legacy records to the letter address and restores that default when cleared", () => {
    const site = createTrackingSite();
    delete site.landAddress;
    expect(normalizeTrackingSite(site).landAddress).toBe("");
    expect(publicTrackingAddress(site).siteAddress).toBe(site.siteAddress);
    expect(publicTrackingAddress({ ...site, landAddress: " \n " }).siteAddress).toBe(site.siteAddress);
  });

  it("uses the land address and its parts without changing correspondence fields", () => {
    const site = createTrackingSite();
    site.landAddress = "Land adjacent to 5, Newnham Lane, Old Basing, RG24 7AT";
    const normalized = normalizeTrackingSite(site);
    expect(normalized.siteAddressParts).toEqual(site.siteAddressParts);
    expect(normalized.siteAddress).toBe(site.siteAddress);
    expect(publicTrackingAddress(normalized)).toEqual({ siteAddress: site.landAddress, siteAddressParts: parseTrackingAddress(site.landAddress) });
    expect(validateTrackingSite(normalized).valid).toBe(true);
    expect(validateTrackingSite({ ...normalized, landAddress: "x".repeat(221) }).errors.some((error) => error.path === "landAddress")).toBe(true);
  });
});
