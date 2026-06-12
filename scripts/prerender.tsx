import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { PassThrough } from "node:stream";
import { fileURLToPath } from "node:url";
import React from "react";
import { renderToPipeableStream } from "react-dom/server";
import { App } from "../src/App";
import { defaultContent } from "../src/data/defaultContent";
import {
  absolutize,
  buildStructuredData,
  getRouteMetadata,
  siteOrigin
} from "../src/lib/seo";

const rootDir = resolve(fileURLToPath(new URL("..", import.meta.url)));
const distDir = resolve(rootDir, "dist");
const template = await readFile(join(distDir, "index.html"), "utf8");
await writeFile(join(distDir, "app.html"), template);

const publicRoutes = [
  "/",
  "/developments",
  ...defaultContent.developments.map((development) => development.ctaHref),
  "/design-build",
  "/vision-process",
  "/about",
  "/land-wanted",
  "/contact",
  "/privacy",
  "/terms",
  "/security-review"
];

for (const route of publicRoutes) {
  installServerWindow(route);
  const appHtml = await renderRoute();
  const html = buildHtml(route, appHtml);
  const outputPath = outputPathForRoute(route);
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, html);
}

console.log(`Prerendered ${publicRoutes.length} public routes.`);

function buildHtml(route: string, appHtml: string) {
  const development = route.startsWith("/developments/")
    ? defaultContent.developments.find((item) => item.id === route.split("/").filter(Boolean)[1])
    : undefined;
  const metadata = getRouteMetadata(defaultContent, route, development);
  const canonical = `${siteOrigin}${route === "/" ? "/" : route}`;

  let html = template.replace(
    /<div id="root"><\/div>/,
    `<div id="root" data-prerendered="true">${appHtml}</div>`
  );

  html = setTitle(html, metadata.title);
  html = upsertMeta(html, "name", "description", metadata.description);
  html = upsertMeta(html, "property", "og:title", metadata.title);
  html = upsertMeta(html, "property", "og:description", metadata.description);
  html = upsertMeta(html, "property", "og:type", development ? "article" : "website");
  html = upsertMeta(html, "property", "og:url", canonical);
  html = upsertMeta(html, "property", "og:image", absolutize(metadata.image));
  html = upsertMeta(html, "name", "twitter:card", "summary_large_image");
  html = upsertMeta(html, "name", "twitter:title", metadata.title);
  html = upsertMeta(html, "name", "twitter:description", metadata.description);
  html = upsertLink(html, "canonical", canonical);
  html = upsertStructuredData(
    html,
    buildStructuredData(defaultContent, development, canonical)
  );

  return html;
}

function renderRoute() {
  return new Promise<string>((resolveRender, rejectRender) => {
    let didError = false;
    const output = new PassThrough();
    let html = "";
    const timeout = setTimeout(() => {
      abort();
      rejectRender(new Error("Prerender timed out."));
    }, 15_000);

    output.on("data", (chunk) => {
      html += chunk.toString();
    });
    output.on("end", () => {
      clearTimeout(timeout);
      didError ? rejectRender(new Error("Prerender completed with errors.")) : resolveRender(html);
    });
    output.on("error", rejectRender);

    const { abort, pipe } = renderToPipeableStream(<App />, {
      onAllReady() {
        pipe(output);
      },
      onError(error) {
        didError = true;
        console.error(error);
      }
    });
  });
}

function outputPathForRoute(route: string) {
  if (route === "/") {
    return join(distDir, "index.html");
  }

  return join(distDir, ...route.split("/").filter(Boolean), "index.html");
}

function installServerWindow(pathname: string) {
  const noop = () => undefined;
  const storage = {
    getItem: () => null,
    setItem: noop,
    removeItem: noop
  };

  Object.assign(globalThis, {
    window: {
      location: { pathname },
      localStorage: storage,
      sessionStorage: storage,
      addEventListener: noop,
      removeEventListener: noop,
      dispatchEvent: noop
    },
    localStorage: storage,
    sessionStorage: storage
  });
}

function setTitle(html: string, title: string) {
  return html.replace(/<title>.*?<\/title>/, `<title>${escapeText(title)}</title>`);
}

function upsertMeta(html: string, attribute: "name" | "property", key: string, content: string) {
  const escapedKey = escapeRegex(key);
  const pattern = new RegExp(`<meta\\s+${attribute}="${escapedKey}"[^>]*>`, "i");
  const tag = `<meta ${attribute}="${escapeAttribute(key)}" content="${escapeAttribute(content.slice(0, 300))}" />`;
  return pattern.test(html) ? html.replace(pattern, tag) : html.replace("</head>", `    ${tag}\n  </head>`);
}

function upsertLink(html: string, rel: string, href: string) {
  const pattern = new RegExp(`<link\\s+rel="${escapeRegex(rel)}"[^>]*>`, "i");
  const tag = `<link rel="${escapeAttribute(rel)}" href="${escapeAttribute(href)}" />`;
  return pattern.test(html) ? html.replace(pattern, tag) : html.replace("</head>", `    ${tag}\n  </head>`);
}

function upsertStructuredData(html: string, data: object) {
  const tag = `<script type="application/ld+json" id="structured-data">${escapeJsonScript(data)}</script>`;
  const pattern = /<script[^>]+id="structured-data"[^>]*>.*?<\/script>/is;
  return pattern.test(html) ? html.replace(pattern, tag) : html.replace("</head>", `    ${tag}\n  </head>`);
}

function escapeText(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function escapeAttribute(value: string) {
  return escapeText(value).replaceAll('"', "&quot;");
}

function escapeJsonScript(value: object) {
  return JSON.stringify(value).replaceAll("<", "\\u003c");
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
