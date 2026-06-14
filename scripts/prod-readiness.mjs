import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const rootDir = resolve(".");
const distDir = join(rootDir, "dist");
const checks = [];

await check("no SSH public key remains in the project root", async () => {
  assert(!existsSync(join(rootDir, "id_ed25519.pub")), "id_ed25519.pub still exists.");
});

await check("no private key files are present in source-controlled surfaces", async () => {
  const candidates = await listFiles(rootDir, {
    ignoreDirs: new Set([".git", "node_modules", "dist", "data", "playwright-report", "test-results"])
  });
  const privateKeys = candidates.filter((file) => /(^|[/\\])id_(rsa|ed25519|ecdsa)$/.test(file));
  const privateKeyMarkers = [];

  for (const file of candidates.filter((item) => /\.(pem|key)$/.test(item))) {
    const content = await readFile(file, "utf8").catch(() => "");
    if (/BEGIN (RSA |OPENSSH |EC |)PRIVATE KEY/.test(content)) {
      privateKeyMarkers.push(file);
    }
  }

  assert(
    privateKeys.length === 0 && privateKeyMarkers.length === 0,
    `Potential private key material found: ${[...privateKeys, ...privateKeyMarkers].join(", ")}`
  );
});

await check(".env is ignored and .env.example documents production controls", async () => {
  const gitignore = await readRequired(".gitignore");
  const envExample = await readRequired(".env.example");
  const requiredKeys = [
    "STUDIO_USER",
    "STUDIO_PASSWORD",
    "STUDIO_AUTH_TOKEN_SECRET",
    "CMS_ENCRYPTION_KEY",
    "STUDIO_TOTP_SECRET",
    "ROYAL_MAIL_TRACKING_API_URL",
    "ROYAL_MAIL_TRACKING_API_KEY",
    "CONTACT_WEBHOOK_URL",
    "NEWSLETTER_WEBHOOK_URL",
    "LEAD_WEBHOOK_HMAC_SECRET"
  ];

  assert(/(^|\r?\n)\.env(\r?\n|$)/.test(gitignore), ".env is not ignored.");
  for (const key of requiredKeys) {
    assert(envExample.includes(`${key}=`), `.env.example is missing ${key}.`);
  }
});

await check("static host security headers are documented", async () => {
  const headers = await readRequired("public/_headers");
  for (const header of [
    "Content-Security-Policy",
    "X-Frame-Options",
    "X-Content-Type-Options",
    "Permissions-Policy",
    "Referrer-Policy"
  ]) {
    assert(headers.includes(header), `public/_headers is missing ${header}.`);
  }
});

await check("robots.txt blocks known studio routes", async () => {
  const robots = await readRequired("public/robots.txt");
  assert(robots.includes("Disallow: /admin"), "robots.txt does not block /admin.");
  assert(robots.includes("Disallow: /studio"), "robots.txt does not block the studio route.");
});

await check("public sitemap includes content and legal routes", async () => {
  const sitemap = await readRequired("public/sitemap.xml");
  for (const route of [
    "/",
    "/developments",
    "/developments/ridings",
    "/developments/meadow-green",
    "/developments/oakdene-heights",
    "/developments/hilltop-park",
    "/design-build",
    "/vision-process",
    "/about",
    "/land-wanted",
    "/new-homes-south-england",
    "/real-estate-development",
    "/land-opportunities",
    "/land-seller-guide",
    "/faq",
    "/contact",
    "/privacy",
    "/terms"
  ]) {
    assert(sitemap.includes(`https://www.kingsvalehomes.co.uk${route === "/" ? "/" : route}`), `sitemap.xml is missing ${route}.`);
  }
});

await check("build output contains prerendered public routes and clean app shell", async () => {
  assert(existsSync(join(distDir, "app.html")), "dist/app.html is missing. Run npm run build.");
  const prerenderedRoutes = (await listFiles(distDir)).filter((file) => file.endsWith("index.html"));
  assert(prerenderedRoutes.length >= 14, `Expected at least 14 prerendered index.html files, found ${prerenderedRoutes.length}.`);
});

await check("public HTML does not reference the private studio chunk", async () => {
  const indexHtml = await readRequired("dist/index.html");
  assert(!/\/assets\/studio-[^"]+\.js/.test(indexHtml), "dist/index.html references the studio chunk.");
});

const failed = checks.filter((item) => item.status === "fail");
console.table(checks);

if (failed.length > 0) {
  console.error(failed.map((item) => item.detail).join("\n"));
  process.exit(1);
}

async function check(name, run) {
  try {
    await run();
    checks.push({ check: name, status: "pass", detail: "" });
  } catch (error) {
    checks.push({
      check: name,
      status: "fail",
      detail: error instanceof Error ? error.message : String(error)
    });
  }
}

async function readRequired(relativePath) {
  const absolutePath = join(rootDir, relativePath);
  assert(existsSync(absolutePath), `${relativePath} is missing.`);
  return readFile(absolutePath, "utf8");
}

async function listFiles(directory, options = {}) {
  const ignoreDirs = options.ignoreDirs ?? new Set();
  const entries = await readdir(directory, { withFileTypes: true }).catch(() => []);
  const files = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = join(directory, entry.name);
      if (entry.isDirectory()) {
        return ignoreDirs.has(entry.name) ? [] : listFiles(fullPath, options);
      }
      return fullPath;
    })
  );
  return files.flat();
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
