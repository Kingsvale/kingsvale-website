import { describe, expect, it } from "vitest";
import { defaultQrStyle } from "./trackingNormalize";
import { buildStyledQrSvg, WORD_QR_EXPORT_SIZE } from "./trackingQrSvg.js";

describe("styled tracking QR renderer", () => {
  it("renders the same branded SVG primitives used by the admin preview and letter export", () => {
    const svg = buildStyledQrSvg(
      "https://www.kingsvalehomes.co.uk/plot/KV0111",
      defaultQrStyle(),
      "KV0111",
      { includeCaption: false }
    );

    expect(svg).toContain('data-qr-svg="true"');
    expect(svg).toContain("#ad9576");
    expect(svg).toContain(">K</text>");
    expect(svg).toContain('rx="');
    expect(svg).not.toContain("Scan to view the plot</text>");
  });

  it("exports a branded 1155px PNG instead of the old plain low-weight QR image", async () => {
    const letterGeneratorPath = "../../server/letter-generator.mjs";
    const { createTrackingQrPng } = await import(/* @vite-ignore */ letterGeneratorPath);

    const png = new Uint8Array(
      await createTrackingQrPng(
        "https://www.kingsvalehomes.co.uk/plot/KV0111",
        defaultQrStyle(),
        "KV0111"
      )
    );
    const pngView = new DataView(png.buffer, png.byteOffset, png.byteLength);

    expect(toHex(png.slice(0, 8))).toBe("89504e470d0a1a0a");
    expect(pngView.getUint32(16, false)).toBe(WORD_QR_EXPORT_SIZE);
    expect(pngView.getUint32(20, false)).toBe(WORD_QR_EXPORT_SIZE);
    expect(png.length).toBeGreaterThan(100_000);
  });

  it("keeps street, town and postcode letter tokens separate", async () => {
    const letterGeneratorPath = "../../server/letter-generator.mjs";
    const { buildLetterTokens } = await import(/* @vite-ignore */ letterGeneratorPath);

    const tokens = buildLetterTokens({
      customerName: "Faris Awan",
      siteAddress: "6 Petworth Court Helston Lane, Windsor, SL4 5HS",
      siteAddressParts: {
        line1: "6 Petworth Court",
        line2: "Helston Lane",
        town: "Windsor",
        county: "",
        postcode: "SL4 5HS"
      },
      letterRecipientMode: "title-owner",
      council: {},
      reference: "KV0111",
      titleNumber: "BK255156"
    }, "https://example.com/track");

    expect(tokens.get("{{address}}")).toBe("6 Petworth Court, Helston Lane");
    expect(tokens.get("{{town}}")).toBe("Windsor");
    expect(tokens.get("{{county}}")).toBe("");
    expect(tokens.get("{{postal_code}}")).toBe("SL4 5HS");
    expect(tokens.get("{{full_address}}")).toBe("6 Petworth Court, Helston Lane, Windsor, SL4 5HS");
  });
});

function toHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}
