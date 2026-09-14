import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { renderLetterPreview } from "../server/letter-preview.mjs";
import { createTrackingQrPng, generateLetterDocx } from "../server/letter-generator.mjs";
import { starterLetterTemplates } from "../src/lib/letterTemplates.js";
import sharp from "sharp";
import jsQR from "jsqr";

const directory = "test-results/letter-previews";
await mkdir(directory, { recursive: true });
const link = "https://kingsvalehomes.co.uk/track/preview-test-only-123456789";
const site = {
  customerName: "Alex Example", letterRecipientMode: "title-owner", reference: "KV-TEST-042",
  siteAddress: "72 Pardown, Oakley, Hampshire, RG23 7DZ",
  siteAddressParts: { line1: "72 Pardown", line2: "", town: "Oakley", county: "Hampshire", postcode: "RG23 7DZ" },
  council: {}, titleNumber: "TEST123"
};
for (const [url] of starterLetterTemplates) {
  const name = url.includes("follow-up") ? "follow-up" : "initial";
  const qr = await createTrackingQrPng(link, { foreground: "#083d29", background: "#ffffff", accent: "#083d29", dotRoundness: 65, finderRoundness: 65, includeLogo: false });
  const generated = generateLetterDocx(await readFile(`public${url}`), site, link, qr);
  const preview = await renderLetterPreview(generated);
  assert.ok(preview.pageCount >= 1 && preview.pageCount <= 3, "Expected a short letter");
  let decoded = false;
  for (const [index, data] of preview.pages.entries()) {
    const bytes = Buffer.from(data.split(",")[1], "base64");
    assert.equal(bytes.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
    const { data: pixels, info } = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    decoded ||= jsQR(new Uint8ClampedArray(pixels), info.width, info.height)?.data === link;
    await writeFile(join(directory, `${name}-${index + 1}.png`), bytes);
  }
  assert.ok(decoded, `${name}: QR must scan from the rendered letter page`);
  console.log(`${name}: ${preview.pageCount} preview pages rendered successfully`);
}
