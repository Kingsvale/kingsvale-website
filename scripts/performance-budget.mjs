import { readdir, readFile, stat } from "node:fs/promises";
import { join, resolve } from "node:path";
import { gzipSync } from "node:zlib";

const distDir = resolve("dist");
const assetsDir = join(distDir, "assets");

const budgets = {
  largestJavaScriptGzip: 72_000,
  totalJavaScriptGzip: 98_000,
  totalCssGzip: 24_000,
  prerenderedRoutes: 12
};

const assetFiles = await listFiles(assetsDir);
const jsFiles = assetFiles.filter((file) => file.endsWith(".js"));
const cssFiles = assetFiles.filter((file) => file.endsWith(".css"));

const jsSizes = await Promise.all(jsFiles.map((file) => gzipSize(file)));
const cssSizes = await Promise.all(cssFiles.map((file) => gzipSize(file)));
const routeHtmlCount = (await listFiles(distDir)).filter((file) => file.endsWith("index.html")).length;
const indexHtml = await readFile(join(distDir, "index.html"), "utf8");

const report = {
  largestJavaScriptGzip: Math.max(0, ...jsSizes),
  totalJavaScriptGzip: sum(jsSizes),
  totalCssGzip: sum(cssSizes),
  prerenderedRoutes: routeHtmlCount,
  studioChunkPubliclyPreloaded: /\/assets\/studio-[^"]+\.js/.test(indexHtml)
};

const failures = [];
if (report.largestJavaScriptGzip > budgets.largestJavaScriptGzip) {
  failures.push(`Largest JS gzip ${report.largestJavaScriptGzip} exceeds ${budgets.largestJavaScriptGzip} bytes.`);
}
if (report.totalJavaScriptGzip > budgets.totalJavaScriptGzip) {
  failures.push(`Total JS gzip ${report.totalJavaScriptGzip} exceeds ${budgets.totalJavaScriptGzip} bytes.`);
}
if (report.totalCssGzip > budgets.totalCssGzip) {
  failures.push(`Total CSS gzip ${report.totalCssGzip} exceeds ${budgets.totalCssGzip} bytes.`);
}
if (report.prerenderedRoutes < budgets.prerenderedRoutes) {
  failures.push(`Only ${report.prerenderedRoutes} prerendered route HTML files found.`);
}
if (report.studioChunkPubliclyPreloaded) {
  failures.push("The private studio chunk is referenced from public index.html.");
}

console.table(report);

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = join(directory, entry.name);
      return entry.isDirectory() ? listFiles(fullPath) : fullPath;
    })
  );
  return files.flat();
}

async function gzipSize(file) {
  const fileInfo = await stat(file);
  if (fileInfo.size === 0) {
    return 0;
  }

  const bytes = await readFile(file);
  return gzipSync(bytes).byteLength;
}

function sum(values) {
  return values.reduce((total, value) => total + value, 0);
}
