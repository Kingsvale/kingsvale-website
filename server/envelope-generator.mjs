import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { buildLetterTokens, replaceDocxText } from "./letter-generator.mjs";
import { createLetterPdf } from "./letter-preview.mjs";

export async function regenerateEnvelopeDocuments(template, site, directory) {
  const tokens = buildLetterTokens(site, "");
  if (!tokens.get("{{full_address}}")?.trim()) {
    throw Object.assign(new Error("Add the recipient's address in Mailing before regenerating envelopes."), { code: "ENVELOPE_ADDRESS" });
  }
  const word = replaceDocxText(template, tokens);
  // Convert successfully before publishing either replacement file.
  const pdf = await createLetterPdf(word);
  const filename = `envelope-${randomBytes(16).toString("hex")}`;
  const name = `${site.reference || "site"}-envelope`;
  await mkdir(directory, { recursive: true });
  await Promise.all([writeFile(join(directory, `${filename}.docx`), word), writeFile(join(directory, `${filename}.pdf`), pdf)]);
  return [
    { kind: "envelope-docx", name: `${name}.docx`, url: `/media/${filename}.docx` },
    { kind: "envelope-pdf", name: `${name}.pdf`, url: `/media/${filename}.pdf` }
  ];
}
