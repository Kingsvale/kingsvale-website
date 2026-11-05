import { renderLetterPreview } from "./letter-preview.mjs";

// Use the same PDF and page images as print preview. Browser Word renderers do
// not reproduce anchored images, theme fonts or Word's line/page layout.
export async function renderLetterCanvas(buffer, paragraphs) {
  for (let attempt = 0; ; attempt++) {
    try {
      const rendered = await renderLetterPreview(buffer, ".docx", true);
      return mapLetterLayout(rendered.layoutXml, rendered.pages, paragraphs);
    } catch (error) {
      // A cancelled edit can leave its native conversion finishing. Let a new
      // editor wait briefly for that conversion instead of failing to open.
      if (error.code !== "PREVIEW_BUSY" || attempt >= 50) throw error;
      await new Promise((done) => setTimeout(done, 200));
    }
  }
}

export function mapLetterLayout(xml, images, paragraphs) {
  const pages = [];
  const segments = [];
  for (const [index, match] of [...xml.matchAll(/<page\b([^>]*)>([\s\S]*?)<\/page>/g)].entries()) {
    const attributes = attrs(match[1]);
    const width = Number(attributes.width), height = Number(attributes.height);
    if (!(width > 0 && height > 0 && images[index])) throw new Error("Invalid rendered page");
    const fonts = new Map();
    for (const font of match[2].matchAll(/<fontspec\b([^>]*)\/>/g)) {
      const item = attrs(font[1]);
      const rawFamily = item.family || "Calibri";
      fonts.set(item.id, { fontFamily: fontFamily(rawFamily), fontSize: Number(item.size) || 11,
        bold: /bold|black|heavy/i.test(rawFamily), italic: /italic|oblique/i.test(rawFamily), underline: false,
        color: /^#[0-9a-f]{6}$/i.test(item.color) ? item.color : "#111111" });
    }
    const text = [];
    for (const piece of match[2].matchAll(/<text\b([^>]*)>([\s\S]*?)<\/text>/g)) {
      const item = attrs(piece[1]);
      const style = fonts.get(item.font) || { fontFamily: "Calibri", fontSize: 11, bold: false, italic: false, underline: false, color: "#111111" };
      const runs = [];
      let bold = 0, italic = 0;
      for (const part of piece[2].matchAll(/<\/?(?:b|i)\b[^>]*>|<[^>]+>|[^<]+/g)) {
        if (/^<b\b/.test(part[0])) bold++;
        else if (part[0] === "</b>") bold--;
        else if (/^<i\b/.test(part[0])) italic++;
        else if (part[0] === "</i>") italic--;
        else if (!part[0].startsWith("<")) runs.push({ ...style, text: decode(part[0]), bold: style.bold || bold > 0, italic: style.italic || italic > 0 });
      }
      const value = runs.map((run) => run.text).join("");
      if (!normalise(value).text) continue;
      text.push({ page: index, x: Number(item.left), y: Number(item.top), width: Number(item.width), height: Number(item.height), text: value, runs });
    }
    // Put superscripts and mixed-font spans on their actual text line before
    // ordering columns. PDF object order often puts the footer before the body.
    const lines = [];
    for (const item of text.sort((a, b) => a.y - b.y || a.x - b.x)) {
      const line = lines.find((entry) => Math.abs(entry.y - item.y) < Math.max(2, Math.min(entry.height, item.height) * .25));
      if (line) line.items.push(item);
      else lines.push({ y: item.y, height: item.height, items: [item] });
    }
    segments.push(...lines.flatMap((line) => line.items.sort((a, b) => a.x - b.x)));
    pages.push({ width, height, image: images[index] });
  }
  if (pages.length !== images.length) throw new Error("Rendered page count does not match");
  let stream = "";
  for (const segment of segments) {
    segment.start = stream.length;
    segment.normalised = normalise(segment.text).text;
    stream += segment.normalised;
    segment.end = stream.length;
  }
  const occupied = [];
  const blocks = [];
  const repeatedMargins = new Set(segments.filter((item) => (item.y < pages[item.page].height * .1 || item.y > pages[item.page].height * .9) &&
    segments.some((other) => other.page !== item.page && other.normalised === item.normalised && Math.abs(other.x - item.x) < 2 && Math.abs(other.y - item.y) < 2)));
  const ordered = [...paragraphs].sort((a, b) => normalise(b.text).text.length - normalise(a.text).text.length);
  for (const pass of [0, 1]) for (const paragraph of ordered) {
    if (blocks.some((block) => block.id === paragraph.id)) continue;
    const needle = normalise(paragraph.text).text;
    if (!needle) continue;
    let positions;
    if (pass === 0) {
      let start = stream.indexOf(needle);
      while (start >= 0 && occupied.some((range) => start < range.end && start + needle.length > range.start)) start = stream.indexOf(needle, start + 1);
      if (start < 0) continue;
      positions = Array.from({ length: needle.length }, (_, index) => start + index);
    } else {
      // A paragraph that continues onto another page can be interrupted in PDF
      // reading order by headers, footers and other already-matched text boxes.
      const available = [], indices = [];
      for (const segment of segments) {
        if (repeatedMargins.has(segment)) continue;
        for (let index = segment.start; index < segment.end; index++) if (!occupied.some((range) => index >= range.start && index < range.end)) {
          available.push(stream[index]); indices.push(index);
        }
      }
      const start = available.join("").indexOf(needle);
      if (start < 0) continue;
      positions = indices.slice(start, start + needle.length);
    }
    const positionIndex = new Map(positions.map((value, index) => [value, index]));
    const start = positions[0], end = positions.at(-1) + 1;
    let rangeStart = start;
    for (let index = 1; index <= positions.length; index++) if (index === positions.length || positions[index] !== positions[index - 1] + 1) {
      occupied.push({ start: rangeStart, end: positions[index - 1] + 1 });
      rangeStart = positions[index];
    }
    const hits = segments.filter((segment) => positions.some((index) => index >= segment.start && index < segment.end));
    const fragments = [];
    for (const page of new Set(hits.map((hit) => hit.page))) {
      const parts = hits.filter((hit) => hit.page === page);
      const x = Math.min(...parts.map((hit) => hit.x));
      const y = Math.min(...parts.map((hit) => hit.y));
      fragments.push({ page, x, y, width: Math.max(...parts.map((hit) => hit.x + hit.width)) - x, height: Math.max(...parts.map((hit) => hit.y + hit.height)) - y });
    }
    const first = fragments[0];
    const prefix = paragraph.text.match(/^\s*/)?.[0] || "";
    const suffix = paragraph.text.slice(prefix.length).match(/\s*$/)?.[0] || "";
    const core = paragraph.text.slice(prefix.length, suffix ? -suffix.length : undefined);
    const source = normalise(core);
    const styles = [];
    for (const hit of hits) {
      let offset = hit.start;
      for (const run of hit.runs) {
        const size = normalise(run.text).text.length;
        for (let index = Math.max(start, offset); index < Math.min(end, offset + size); index++) if (positionIndex.has(index)) styles[positionIndex.get(index)] = run;
        offset += size;
      }
    }
    const runs = [];
    let normalIndex = 0;
    for (let index = 0; index < core.length; index++) {
      while (normalIndex + 1 < source.positions.length && source.positions[normalIndex + 1] <= index) normalIndex++;
      const style = styles[normalIndex] || hits[0].runs[0];
      const { text: ignored, ...format } = style;
      void ignored;
      const previous = runs.at(-1);
      if (previous && JSON.stringify({ ...previous, text: "" }) === JSON.stringify({ ...format, text: "" })) previous.text += core[index];
      else runs.push({ ...format, text: core[index] });
    }
    const lineYs = [...new Set(hits.filter((hit) => hit.page === first.page).map((hit) => Math.round(hit.y * 10) / 10))].sort((a, b) => a - b);
    const font = hits[0].runs[0];
    const lineHeight = lineYs.length > 1 ? Math.max(font.fontSize, Math.min(font.fontSize * 2.5, lineYs[1] - lineYs[0])) : font.fontSize * 1.2;
    blocks.push({ id: paragraph.id, ...first, fragments, prefix, suffix, runs, lineHeight });
  }
  return { pages, blocks: blocks.sort((a, b) => a.id - b.id) };
}

function attrs(value) { return Object.fromEntries([...value.matchAll(/([\w:-]+)="([^"]*)"/g)].map((match) => [match[1], decode(match[2])])); }
function decode(value) { return value.replace(/&#(x[0-9a-f]+|\d+);|&(amp|lt|gt|quot|apos);/gi, (_, numeric, named) => numeric ? String.fromCodePoint(numeric[0] === "x" ? parseInt(numeric.slice(1), 16) : Number(numeric)) : ({ amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" })[named.toLowerCase()]); }
function normalise(value) {
  let text = "", offset = 0;
  const positions = [];
  for (const character of value) {
    const normal = character.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
    text += normal;
    for (let index = 0; index < normal.length; index++) positions.push(offset);
    offset += character.length;
  }
  return { text, positions };
}
function fontFamily(value) {
  const name = value.replace(/^[A-Z]{6}\+/, "").replace(/[-,](Bold|Italic|Oblique|Regular|Roman|BoldItalic|BoldOblique).*$/i, "");
  if (/TimesNewRoman|Times-Roman/i.test(name)) return "Times New Roman";
  if (/ArialMT|Arial-BoldMT/.test(name)) return "Arial";
  return name.replace(/PSMT$|MT$/, "");
}
