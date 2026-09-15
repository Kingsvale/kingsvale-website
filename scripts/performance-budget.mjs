import { readdir, readFile, stat } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { gzipSync } from "node:zlib";

const distDir = resolve("dist");
const assetsDir = join(distDir, "assets");

const budgets = {
  largestJavaScriptGzip: 72_000,
  // Includes homepage project selection and its publishing validation (+151 B gzip).
  totalPublicJavaScriptGzip: 101_250,
  totalCssGzip: 24_000,
  deferredMapJavaScriptGzip: 55_000,
  mapEditorJavaScriptGzip: 80_000,
  mapCssGzip: 16_000,
  prerenderedRoutes: 22
};

const assetFiles = await listFiles(assetsDir);
const jsFiles = assetFiles.filter((file) => file.endsWith(".js"));
// Mapping is loaded only on land-map pages; retain the existing marketing-site budgets.
const isMapViewer = (file) => /^land-map-(engine|view)-/.test(basename(file));
const isMapEditor = (file) => /^studio-map-tools-/.test(basename(file));
const isMapCss = (file) => isMapViewer(file) || isMapEditor(file) || /^land-map-/.test(basename(file));
const publicJsFiles = jsFiles.filter((file) => !isPrivateJavaScriptChunk(file) && !isMapViewer(file));
const cssFiles = assetFiles.filter((file) => file.endsWith(".css"));

const jsSizes = await Promise.all(jsFiles.map((file) => gzipSize(file)));
const publicJsSizes = await Promise.all(publicJsFiles.map((file) => gzipSize(file)));
const cssSizes = await Promise.all(cssFiles.map((file) => gzipSize(file)));
const coreCssSizes = await Promise.all(cssFiles.filter((file) => !isMapCss(file)).map(gzipSize));
const coreJsSizes = await Promise.all(jsFiles.filter((file) => !isMapEditor(file)).map(gzipSize));
const mapViewerSizes = await Promise.all(jsFiles.filter(isMapViewer).map(gzipSize));
const mapEditorSizes = await Promise.all(jsFiles.filter(isMapEditor).map(gzipSize));
const mapCssSizes = await Promise.all(cssFiles.filter(isMapCss).map(gzipSize));
const routeHtmlCount = (await listFiles(distDir)).filter((file) => file.endsWith("index.html")).length;
const indexHtml = await readFile(join(distDir, "index.html"), "utf8");
const publicChunkStudioImports = await findPublicStudioChunkImports(jsFiles);

const report = {
  largestJavaScriptGzip: Math.max(0, ...coreJsSizes),
  totalPublicJavaScriptGzip: sum(publicJsSizes),
  totalJavaScriptGzip: sum(jsSizes),
  totalCssGzip: sum(coreCssSizes),
  allCssGzip: sum(cssSizes),
  deferredMapJavaScriptGzip: sum(mapViewerSizes),
  mapEditorJavaScriptGzip: sum(mapEditorSizes),
  mapCssGzip: sum(mapCssSizes),
  prerenderedRoutes: routeHtmlCount,
  studioChunkPubliclyPreloaded: /\/assets\/studio-[^"]+\.js/.test(indexHtml),
  publicChunkStudioImports: publicChunkStudioImports.length > 0 ? publicChunkStudioImports.join(", ") : "none"
};

const failures = [];
for (const key of ["deferredMapJavaScriptGzip", "mapEditorJavaScriptGzip", "mapCssGzip"]) {
  if (report[key] > budgets[key]) failures.push(`${key} ${report[key]} exceeds ${budgets[key]} bytes.`);
}
if (/\/assets\/(land-map-(?:engine|view)|studio-map)-/.test(indexHtml)) {
  failures.push("The homepage must not preload the optional land-map viewer or editing tools.");
}
if (report.largestJavaScriptGzip > budgets.largestJavaScriptGzip) {
  failures.push(`Largest JS gzip ${report.largestJavaScriptGzip} exceeds ${budgets.largestJavaScriptGzip} bytes.`);
}
if (report.totalPublicJavaScriptGzip > budgets.totalPublicJavaScriptGzip) {
  failures.push(
    `Public JS gzip ${report.totalPublicJavaScriptGzip} exceeds ${budgets.totalPublicJavaScriptGzip} bytes.`
  );
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
if (publicChunkStudioImports.length > 0) {
  failures.push(`Public chunks import the private studio chunk: ${publicChunkStudioImports.join(", ")}.`);
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

function isPrivateJavaScriptChunk(file) {
  return /^studio-[\w-]+\.js$/.test(basename(file));
}

async function findPublicStudioChunkImports(files) {
  const studioChunkImportPattern = /(?:from|import\()\s*["']\.\/studio-[^"']+\.js["']|\/assets\/studio-[^"']+\.js/;
  const leaks = [];

  for (const file of files.filter((item) => !isPrivateJavaScriptChunk(item))) {
    const source = await readFile(file, "utf8");
    if (studioChunkImportPattern.test(source)) {
      leaks.push(basename(file));
    }
  }

  return leaks;
}
