import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createLetterPdf, renderLetterPreview } from "../server/letter-preview.mjs";
import { buildLetterTokens, replaceDocxText, createTrackingQrPng, generateLetterDocx, extractLetterParagraphs, editLetterParagraphs } from "../server/letter-generator.mjs";
import { starterLetterTemplates } from "../src/lib/letterTemplates.js";
import { renderLetterCanvas } from "../server/letter-layout.mjs";
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
  await writeFile(join(directory, `${name}.docx`), generated);
  const pdf = await createLetterPdf(generated);
  await writeFile(join(directory, `${name}.pdf`), pdf);
  const preview = await renderLetterPreview(pdf, ".pdf");
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
  const layout = await renderLetterCanvas(generated, extractLetterParagraphs(generated));
  assert.deepEqual(layout.pages.map((page) => page.image), preview.pages, `${name}: editor must use the exact print-preview pages`);
  assert.ok(layout.blocks.some((block) => block.runs.map((run) => run.text).join("").startsWith("Dear ")), `${name}: greeting must be editable on the printed page`);
  console.log(`${name}: ${preview.pageCount} preview pages rendered successfully`);
}

const initial = await readFile(join(directory, "initial.docx"));
const greeting = extractLetterParagraphs(initial).find((item) => item.text.startsWith("Dear "));
const edited = editLetterParagraphs(initial, [{ id: greeting.id, text: "Dear Alex Example,", alignment: "left", runs: [
  { text: "Dear Alex Example,", bold: true, italic: false, underline: false, fontSize: 14, fontFamily: "Calibri", color: "#083d29" }
] }]);
await writeFile(join(directory, "initial-edited.docx"), edited);
const editedPdf = await createLetterPdf(edited);
await writeFile(join(directory, "initial-edited.pdf"), editedPdf);
const editedPreview = await renderLetterPreview(editedPdf, ".pdf");
let editedQrDecoded = false;
for (const [index, page] of editedPreview.pages.entries()) {
  const bytes = Buffer.from(page.split(",")[1], "base64");
  await writeFile(join(directory, `initial-edited-${index + 1}.png`), bytes);
  const { data, info } = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  editedQrDecoded ||= jsQR(new Uint8ClampedArray(data), info.width, info.height)?.data === link;
}
assert.ok(editedQrDecoded, "Edited letter QR must retain its original tracking link");
console.log(`edited initial: ${editedPreview.pageCount} preview pages rendered; QR preserved`);

const envelopeTemplate = await readFile("public/templates/kingsvale-envelope-template.docx");
for (const [name, recipient] of [
  ["envelope", site],
  ["envelope-second-line", { ...site, customerName: "Beverley Anne Robertson-Bailey", siteAddressParts: { line1: "22 Example Road", line2: "Mickleover", town: "Derby", county: "", postcode: "DE3 0BD" } }],
  ["envelope-long-address", { ...site, customerName: "The Trustees of Alexandra Robin Heather Chadwick-Williams and Christopher Jonathan Robertson-Bailey", siteAddressParts: { line1: "The Old Mill House and Land Adjoining The Former Station Buildings, 125 Example Road", line2: "", town: "London", county: "", postcode: "SW2 2TB" } }]
]) {
  const envelope = replaceDocxText(envelopeTemplate, buildLetterTokens(recipient, link));
  await writeFile(join(directory, `${name}.docx`), envelope);
  const envelopePdf = await createLetterPdf(envelope);
  await writeFile(join(directory, `${name}.pdf`), envelopePdf);
  const preview = await renderLetterPreview(envelopePdf, ".pdf", true);
  assert.equal(preview.pageCount, 1, "Envelope must contain only the recipient address front");
  const tops = [...preview.layoutXml.matchAll(/<text\b[^>]*top="([\d.]+)"/g)].map((match) => Number(match[1])).sort((a, b) => a - b);
  const gaps = tops.slice(1).map((top, index) => top - tops[index]).filter((gap) => gap > 1);
  assert.ok(gaps.length >= 3 && Math.max(...gaps) < Math.min(...gaps) * 1.5,
    `${name}: all address lines must have consistent spacing, including when the second line is blank`);
  for (const [index, page] of preview.pages.entries()) await writeFile(join(directory, `${name}-${index + 1}.png`), Buffer.from(page.split(",")[1], "base64"));
  console.log(`${name}: one address-only front page rendered with consistent line spacing`);
}
