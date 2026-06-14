import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const host = process.env.INDEXNOW_HOST || "www.kingsvalehomes.co.uk";
const key = process.env.INDEXNOW_KEY;
const keyLocation = process.env.INDEXNOW_KEY_LOCATION || (key ? `https://${host}/${key}.txt` : "");
const endpoint = process.env.INDEXNOW_ENDPOINT || "https://api.indexnow.org/indexnow";

if (!key) {
  console.error("INDEXNOW_KEY is required. Create a public key file first, then rerun this command.");
  process.exit(1);
}

const urlList = process.env.INDEXNOW_URLS
  ? parseUrlList(process.env.INDEXNOW_URLS)
  : await readUrlsFromSitemap();

if (urlList.length === 0) {
  console.error("No URLs found to submit.");
  process.exit(1);
}

const response = await fetch(endpoint, {
  method: "POST",
  headers: {
    "Content-Type": "application/json; charset=utf-8"
  },
  body: JSON.stringify({
    host,
    key,
    keyLocation,
    urlList
  })
});

if (!response.ok) {
  const body = await response.text().catch(() => "");
  console.error(`IndexNow submission failed with ${response.status} ${response.statusText}.`);
  if (body) {
    console.error(body);
  }
  process.exit(1);
}

console.log(`Submitted ${urlList.length} URLs to IndexNow for ${host}.`);

async function readUrlsFromSitemap() {
  const sitemapPath = resolve("public", "sitemap.xml");
  const sitemap = await readFile(sitemapPath, "utf8");
  const urls = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)]
    .map((match) => match[1]?.trim())
    .filter(Boolean);

  return parseUrlList(urls.join("\n"));
}

function parseUrlList(value) {
  return [...new Set(
    value
      .split(/[\s,]+/)
      .map((url) => url.trim())
      .filter(Boolean)
      .filter((url) => {
        try {
          return new URL(url).host === host;
        } catch {
          return false;
        }
      })
  )];
}
