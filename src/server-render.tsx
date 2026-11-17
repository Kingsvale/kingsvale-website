import { PassThrough } from "node:stream";
import { renderToPipeableStream } from "react-dom/server";
import { Page } from "./App";
import { SiteContentProvider } from "./components/SiteText";
import { defaultContent } from "./data/defaultContent";
import { normalizeSiteContent } from "./lib/contentNormalize";
import { getRouteMetadata, buildStructuredData, absolutize, siteOrigin } from "./lib/seo";
import type { SiteContent } from "./lib/contentTypes";

export async function renderPublishedPage(template: string, published: SiteContent | null, route: string, preview = false) {
  const content = normalizeSiteContent(published ?? defaultContent);
  const privateRoute = route.startsWith("/track/") || route === "/studio" || route === "/admin";
  const development = content.developments.find(item => item.ctaHref === route || route === `/developments/${item.id}`);
  const metadata = getRouteMetadata(content, route, development);
  const canonical = `${siteOrigin}${route}`;
  let html = template.replace(/<title>.*?<\/title>/s, `<title>${escapeText(metadata.title)}</title>`);
  const meta = (attribute: string, name: string, value: string) => {
    const tag = `<meta ${attribute}="${name}" content="${escapeText(value)}" />`;
    const pattern = new RegExp(`<meta\\s+${attribute}="${name}"[^>]*>`, "i");
    html = pattern.test(html) ? html.replace(pattern, () => tag) : html.replace("</head>", `${tag}</head>`);
  };
  meta("name", "description", metadata.description);
  meta("name", "robots", privateRoute || preview ? "noindex, nofollow" : "index, follow, max-image-preview:large");
  for (const prefix of ["og", "twitter"]) {
    const attribute = prefix === "og" ? "property" : "name";
    meta(attribute, `${prefix}:title`, metadata.title);
    meta(attribute, `${prefix}:description`, metadata.description);
    meta(attribute, `${prefix}:image`, absolutize(metadata.image));
    meta(attribute, `${prefix}:image:alt`, metadata.imageAlt);
  }
  meta("property", "og:url", canonical);
  html = html.replace(/<link\s+rel="canonical"[^>]*>/i, () => `<link rel="canonical" href="${escapeText(canonical)}" />`);
  html = html.replace(/<script[^>]+id="structured-data"[^>]*>.*?<\/script>/is, "");
  html = html.replace("</head>", () => `<script type="application/ld+json" id="structured-data">${json(buildStructuredData(content, development, canonical, route))}</script></head>`);
  const markup = privateRoute || preview ? "" : await renderMarkup(content, route);
  html = html.replace(/<div id="root"[^>]*><\/div>/, () => `<div id="root"${markup ? ' data-prerendered="true"' : ""}>${markup}</div>`);
  return html.replace("</head>", () => `<script type="application/json" id="kingsvale-content">${json({ content })}</script></head>`);
}

function renderMarkup(content: SiteContent, route: string) {
  return new Promise<string>((resolve, reject) => {
    const output = new PassThrough();
    let html = "";
    let failed = false;
    const timer = setTimeout(() => { stream.abort(); reject(new Error("Page rendering timed out")); }, 10_000);
    output.on("data", chunk => { html += chunk.toString(); });
    output.on("end", () => { clearTimeout(timer); if (!failed) resolve(html); });
    output.on("error", error => { clearTimeout(timer); reject(error); });
    const stream = renderToPipeableStream(<SiteContentProvider content={content} route={route}><Page content={content} route={route} /></SiteContentProvider>, {
      onAllReady() { stream.pipe(output); },
      onError(error) { failed = true; clearTimeout(timer); reject(error); }
    });
  });
}
function json(value: unknown) { return JSON.stringify(value).replaceAll("<", "\\u003c").replaceAll("\u2028", "\\u2028").replaceAll("\u2029", "\\u2029"); }
function escapeText(value: string) { return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll('"', "&quot;").replaceAll(">", "&gt;"); }
