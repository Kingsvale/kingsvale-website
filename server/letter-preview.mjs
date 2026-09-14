import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { createHash } from "node:crypto";

const run = promisify(execFile);
const cache = new Map();
let rendering = false;

// Only one conversion at a time: each renderer uses an isolated profile and a
// temporary directory. Generated previews are disposable, never source records.
export async function renderLetterPreview(buffer, extension = ".docx") {
  if (![".docx", ".pdf"].includes(extension) || buffer.length > 12_000_000) throw new Error("Unsupported preview file");
  const key = createHash("sha256").update(buffer).digest("hex");
  if (cache.has(key)) return cache.get(key);
  if (rendering) throw Object.assign(new Error("Another preview is being prepared. Please try again shortly."), { code: "PREVIEW_BUSY" });
  rendering = true;
  let directory;
  try {
    directory = await mkdtemp(join(tmpdir(), "kingsvale-preview-"));
    await writeFile(join(directory, `letter${extension}`), buffer);
    const options = { timeout: 45000, maxBuffer: 1_000_000, windowsHide: true };
    if (extension === ".docx") {
      await run(process.env.LIBREOFFICE_PATH || "libreoffice", [
        `-env:UserInstallation=${pathToFileURL(join(directory, "profile")).href}`,
        "--headless", "--nologo", "--nodefault", "--nofirststartwizard", "--convert-to", "pdf",
        "--outdir", directory, join(directory, "letter.docx")
      ], options);
    }
    const pdf = join(directory, "letter.pdf");
    const info = await run("pdfinfo", [pdf], options);
    const pageCount = Number(info.stdout.match(/^Pages:\s+(\d+)/m)?.[1]);
    if (!pageCount || pageCount > 12) throw Object.assign(new Error("Preview supports letters up to 12 pages. Download this document to view all pages."), { code: "PREVIEW_LIMIT" });
    await run("pdftoppm", ["-scale-to", "1400", "-png", pdf, join(directory, "page")], options);
    const files = (await readdir(directory)).filter((name) => /^page-\d+\.png$/.test(name)).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    if (files.length !== pageCount) throw new Error("Preview pages missing");
    const pages = await Promise.all(files.map(async (name) => `data:image/png;base64,${(await readFile(join(directory, name))).toString("base64")}`));
    const result = { pages, pageCount };
    if (cache.size >= 4) cache.delete(cache.keys().next().value);
    cache.set(key, result);
    return result;
  } finally {
    rendering = false;
    // directory is the exact value returned by mkdtemp above.
    if (directory) await rm(directory, { recursive: true, force: true });
  }
}
