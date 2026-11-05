import { createHash, randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createEditableLetterDocx, editLetterParagraphs, extractLetterParagraphs, letterCanvasDecoration } from "./letter-generator.mjs";
import { createLetterPdf } from "./letter-preview.mjs";

export function letterContent(buffer, includeCanvas = true) {
  const paragraphs = extractLetterParagraphs(buffer);
  if (!paragraphs.length || paragraphs.length > 200 || paragraphs.reduce((total, item) => total + item.text.length, 0) > 100_000) {
    throw invalid("This document has too much text for the letter editor. Download it to edit in Word.");
  }
  return { version: createHash("sha256").update(buffer).digest("hex"), paragraphs,
    ...(includeCanvas ? { editorDocument: createEditableLetterDocx(buffer).toString("base64"), decoration: letterCanvasDecoration(buffer) } : {}) };
}

export function applyLetterChanges(buffer, payload, allowEmpty = false) {
  const content = letterContent(buffer, false);
  if (payload.version !== content.version) throw invalid("This letter has changed. Close the editor and open it again.");
  if (!Array.isArray(payload.changes) || (!allowEmpty && !payload.changes.length) || payload.changes.length > 200) throw invalid("Change some letter text before saving.");
  const ids = new Set();
  for (const change of payload.changes) {
    if (!change || !Number.isInteger(change.id) || !content.paragraphs.some((item) => item.id === change.id) || ids.has(change.id) ||
      typeof change.text !== "string" || change.text.length > 12_000 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]/.test(change.text)) {
      throw invalid("Letter changes contain an invalid text block. Use up to 12,000 characters per block.");
    }
    if (change.alignment !== undefined && !["left", "center", "right", "both"].includes(change.alignment)) throw invalid("Choose a supported text alignment.");
    if (change.runs !== undefined) {
      if (!Array.isArray(change.runs) || change.runs.length > 2000 || change.runs.some((run) => !run || typeof run.text !== "string" ||
        ["bold", "italic", "underline"].some((key) => typeof run[key] !== "boolean") ||
        typeof run.fontSize !== "number" || !Number.isFinite(run.fontSize) || run.fontSize < 6 || run.fontSize > 72 ||
        typeof run.fontFamily !== "string" || run.fontFamily.length > 80 || /[\u0000-\u001f]/.test(run.fontFamily) ||
        typeof run.color !== "string" || !/^#[0-9a-f]{6}$/i.test(run.color)) || change.runs.map((run) => run.text).join("") !== change.text) {
        throw invalid("Letter formatting is invalid. Please check the selected text and try again.");
      }
    }
    ids.add(change.id);
  }
  const changes = payload.changes.map((item) => ({ id: item.id, text: item.text.replace(/\r\n?/g, "\n"),
    ...(item.alignment ? { alignment: item.alignment } : {}),
    ...(item.runs ? { runs: item.runs.map((run) => ({ ...run, text: run.text.replace(/\r\n?/g, "\n") })) } : {}) }));
  const length = content.paragraphs.reduce((total, item) => total + (changes.find((change) => change.id === item.id)?.text ?? item.text).length, 0);
  if (length > 100_000) throw invalid("Use up to 100,000 characters in a letter.");
  return editLetterParagraphs(buffer, changes);
}

export async function saveEditedLetter(buffer, payload, directory) {
  const generated = applyLetterChanges(buffer, payload);
  // Finish conversion before saving either output or changing the site's links.
  const pdf = await createLetterPdf(generated);
  const stem = typeof payload.name === "string" ? payload.name.replace(/\.docx$/i, "").replace(/[/\\\u0000-\u001f]/g, "").slice(0, 140) : "letter";
  const filename = `edited-letter-${randomBytes(16).toString("hex")}`;
  await mkdir(directory, { recursive: true });
  await Promise.all([writeFile(join(directory, `${filename}.docx`), generated), writeFile(join(directory, `${filename}.pdf`), pdf)]);
  return { name: `${stem || "letter"}.docx`, url: `/media/${filename}.docx`, bytes: generated.length,
    contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    documents: [{ kind: "letter-pdf", name: `${stem || "letter"}.pdf`, url: `/media/${filename}.pdf` }] };
}

function invalid(message) { return Object.assign(new Error(message), { code: "LETTER_EDIT_INVALID" }); }
