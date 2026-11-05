import { deflateRawSync, inflateRawSync } from "node:zlib";
import sharp from "sharp";
import { buildStyledQrSvg, safeColor, WORD_QR_EXPORT_SIZE } from "../src/lib/trackingQrSvg.js";
import { publicTrackingAddress, parseTrackingAddress } from "../src/lib/trackingAddress.js";

const textNodePattern = /<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g;
const xmlEntryPattern = /^word\/(?!_rels\/).+\.xml$/;
const wordRelationshipPattern = /<Relationship\b[^>]*\/>/g;
const maxDocxEntries = 600;
const maxDocxEntryBytes = 12_000_000;
const maxDocxUncompressedBytes = 40_000_000;

export async function createTrackingQrPng(value, style = {}, title = "") {
  const svg = buildStyledQrSvg(value || "https://www.kingsvalehomes.co.uk", style, title, {
    includeCaption: false
  });

  return sharp(Buffer.from(svg))
    .resize({
      width: WORD_QR_EXPORT_SIZE,
      height: WORD_QR_EXPORT_SIZE,
      fit: "fill",
      background: safeColor(style?.background, "#fbf8f2")
    })
    .png()
    .toBuffer();
}

export function generateLetterDocx(templateBuffer, site, publicLink, qrPngBuffer) {
  const entries = readZip(templateBuffer);
  const replacements = buildLetterTokens(site, publicLink);
  let qrTarget = findQrMediaTarget(entries);

  for (const entry of entries) {
    if (xmlEntryPattern.test(entry.name)) {
      entry.data = Buffer.from(replacePlaceholdersInWordXml(entry.data.toString("utf8"), replacements), "utf8");
    }

    if (qrTarget && entry.name === qrTarget) {
      entry.data = Buffer.from(qrPngBuffer);
      entry.method = 8;
    }
  }

  if (!qrTarget) {
    qrTarget = findFallbackQrMedia(entries);
    const entry = qrTarget ? entries.find((item) => item.name === qrTarget) : null;
    if (entry) {
      entry.data = Buffer.from(qrPngBuffer);
      entry.method = 8;
    }
  }

  return writeZip(entries);
}

export function replaceDocxText(templateBuffer, replacements) {
  const entries = readZip(templateBuffer);
  const replacementMap = replacements instanceof Map ? replacements : new Map(Object.entries(replacements));

  for (const entry of entries) {
    if (xmlEntryPattern.test(entry.name)) {
      entry.data = Buffer.from(replacePlaceholdersInWordXml(entry.data.toString("utf8"), replacementMap), "utf8");
    }
  }

  return writeZip(entries);
}

// Edit the saved document itself, so uploaded letterheads, QR images, page setup
// and unchanged Word runs survive a small wording change.
export function extractLetterParagraphs(buffer) {
  const document = readZip(buffer).find((entry) => entry.name === "word/document.xml");
  if (!document) throw new Error("DOCX document is missing.");
  return letterParagraphRanges(document.data.toString("utf8")).map((paragraph, id) => ({
    id, text: wordTextTokens(paragraph.xml).map((token) => token.text).join("")
  })).filter((paragraph) => paragraph.text.trim());
}

export function createEditableLetterDocx(buffer) {
  const entries = readZip(buffer);
  const document = entries.find((entry) => entry.name === "word/document.xml");
  if (!document) throw new Error("DOCX document is missing.");
  let xml = document.data.toString("utf8");
  const paragraphs = letterParagraphRanges(xml);
  for (let id = paragraphs.length - 1; id >= 0; id--) {
    const paragraph = paragraphs[id];
    if (!wordTextTokens(paragraph.xml).some((token) => token.text.trim())) continue;
    const properties = paragraph.xml.match(/^<w:p\b[^>]*>\s*(?:<w:pPr\b[^>]*>[\s\S]*?<\/w:pPr>|<w:pPr\s*\/>)/);
    const offset = properties?.[0].length ?? paragraph.xml.indexOf(">") + 1;
    const marked = paragraph.xml.slice(0, offset) + `<w:bookmarkStart w:id="${100000000 + id}" w:name="KV_EDIT_${id}"/>` + paragraph.xml.slice(offset);
    xml = xml.slice(0, paragraph.start) + marked + xml.slice(paragraph.end);
  }
  document.data = Buffer.from(xml);
  return writeZip(entries);
}

export function letterCanvasDecoration(buffer) {
  const document = readZip(buffer).find((entry) => entry.name === "word/document.xml");
  const xml = document?.data.toString("utf8") ?? "";
  const pageWidth = Number(xml.match(/<w:pgSz\b[^>]*w:w="(\d+)"/)?.[1] || 11906) / 20;
  // Word's full-width rectangles aren't handled by the browser renderer. Carry
  // their simple fill into the canvas without changing the actual DOCX artwork.
  for (const match of xml.matchAll(/<wp:anchor\b[^>]*behindDoc="1"[\s\S]*?<\/wp:anchor>/g)) {
    const shape = match[0];
    const extent = shape.match(/<wp:extent\b[^>]*cx="(\d+)"[^>]*cy="(\d+)"/);
    const color = shape.match(/<a:solidFill>\s*<a:srgbClr\s+val="([0-9a-f]{6})"/i)?.[1];
    const top = shape.match(/<wp:positionV\b[^>]*>\s*<wp:posOffset>(-?\d+)<\/wp:posOffset>/)?.[1];
    if (extent && color && Number(top) < 0 && Number(extent[1]) / 12700 > pageWidth * 0.85 && Number(extent[2]) / 12700 < 220 && /<a:prstGeom\b[^>]*prst="rect"/.test(shape)) {
      return { headerFill: { color: `#${color}`, heightPt: Number(extent[2]) / 12700 } };
    }
  }
  return {};
}

export function editLetterParagraphs(buffer, changes) {
  const entries = readZip(buffer);
  const document = entries.find((entry) => entry.name === "word/document.xml");
  if (!document) throw new Error("DOCX document is missing.");
  const xml = document.data.toString("utf8");
  const paragraphs = letterParagraphRanges(xml);
  let next = xml;
  for (const change of [...changes].sort((a, b) => b.id - a.id)) {
    const paragraph = paragraphs[change.id];
    if (!paragraph) throw new Error("DOCX paragraph is missing.");
    let edited = change.runs ? formatWordParagraph(paragraph.xml, change.runs) : editWordParagraph(paragraph.xml, change.text);
    if (change.alignment) {
      const alignment = `<w:jc w:val="${change.alignment}"/>`;
      const properties = edited.match(/<w:pPr\b[^>]*>[\s\S]*?<\/w:pPr>/)?.[0];
      if (properties) edited = edited.replace(properties, properties.replace(/<w:jc\b[^>]*\/>/g, "").replace("</w:pPr>", alignment + "</w:pPr>"));
      else if (/<w:pPr\s*\/>/.test(edited)) edited = edited.replace(/<w:pPr\s*\/>/, `<w:pPr>${alignment}</w:pPr>`);
      else edited = edited.replace(/^(<w:p\b[^>]*>)/, `$1<w:pPr>${alignment}</w:pPr>`);
    }
    next = next.slice(0, paragraph.start) + edited + next.slice(paragraph.end);
  }
  document.data = Buffer.from(next);
  return writeZip(entries);
}

function formatWordParagraph(xml, runs) {
  const firstProperties = xml.match(/<w:rPr\b[^>]*>[\s\S]*?<\/w:rPr>/)?.[0] ?? "<w:rPr></w:rPr>";
  const cleanProperties = firstProperties.replace(/<w:(b|bCs|i|iCs|u|sz|szCs|rFonts|color)\b[^>]*(?:\/>|>[\s\S]*?<\/w:\1>)/g, "");
  const formatted = runs.map((run) => {
    const font = encodeXml(run.fontFamily || "Calibri").replaceAll('"', "&quot;");
    const size = Math.round((run.fontSize || 11) * 2);
    const properties = `<w:b w:val="${run.bold ? 1 : 0}"/><w:i w:val="${run.italic ? 1 : 0}"/><w:u w:val="${run.underline ? "single" : "none"}"/><w:sz w:val="${size}"/><w:szCs w:val="${size}"/><w:rFonts w:ascii="${font}" w:hAnsi="${font}"/>${run.color ? `<w:color w:val="${run.color.slice(1)}"/>` : ""}`;
    const text = run.text.split(/(\n|\t)/).map((part) => part === "\n" ? "<w:br/>" : part === "\t" ? "<w:tab/>" : `<w:t xml:space="preserve">${encodeXml(part)}</w:t>`).join("");
    return `<w:r>${cleanProperties.replace("</w:rPr>", properties + "</w:rPr>")}${text}</w:r>`;
  }).join("");
  for (const token of wordTextTokens(xml).reverse()) xml = xml.slice(0, token.start) + xml.slice(token.end);
  const properties = xml.match(/^<w:p\b[^>]*>\s*(?:<w:pPr\b[^>]*>[\s\S]*?<\/w:pPr>|<w:pPr\s*\/>)/);
  const offset = properties?.[0].length ?? xml.indexOf(">") + 1;
  return xml.slice(0, offset) + formatted + xml.slice(offset);
}

function letterParagraphRanges(xml) {
  const stack = [];
  const paragraphs = [];
  // Text boxes can contain paragraphs inside a drawing's outer paragraph.
  // Only leaf paragraphs own editable text; never rewrite the drawing wrapper.
  for (const match of xml.matchAll(/<\/?w:p\b[^>]*>/g)) {
    if (match[0].startsWith("</")) {
      const paragraph = stack.pop();
      if (paragraph && !paragraph.nested) {
        const end = match.index + match[0].length;
        paragraphs.push({ start: paragraph.start, end, xml: xml.slice(paragraph.start, end) });
      }
    } else if (!match[0].endsWith("/>")) {
      if (stack.length) stack.at(-1).nested = true;
      stack.push({ start: match.index, nested: false });
    }
  }
  return paragraphs.sort((a, b) => a.start - b.start);
}

function wordTextTokens(xml) {
  return [...xml.matchAll(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>|<w:(?:tab|br|cr)\b[^>]*\/>/g)]
    .filter((match) => !/<w:br\b[^>]*w:type="(?:page|column)"/.test(match[0]))
    .map((match) => ({ start: match.index, end: match.index + match[0].length,
      text: match[1] !== undefined ? decodeXml(match[1]) : match[0].startsWith("<w:tab") ? "\t" : "\n" }));
}

function editWordParagraph(xml, text) {
  const tokens = wordTextTokens(xml);
  const original = tokens.map((token) => token.text).join("");
  if (original === text) return xml;
  let start = 0;
  while (start < original.length && start < text.length && original[start] === text[start]) start++;
  let suffix = 0;
  while (suffix < original.length - start && suffix < text.length - start && original.at(-1 - suffix) === text.at(-1 - suffix)) suffix++;
  const end = original.length - suffix;
  const inserted = text.slice(start, text.length - suffix);
  let offset = 0;
  let insertedAt = false;
  const replacements = tokens.map((token) => {
    const tokenStart = offset;
    offset += token.text.length;
    if (offset < start || tokenStart > end) return token;
    const before = token.text.slice(0, Math.max(0, start - tokenStart));
    const after = token.text.slice(Math.min(token.text.length, Math.max(0, end - tokenStart)));
    const value = before + (insertedAt ? "" : inserted) + after;
    insertedAt = true;
    return { ...token, replacement: value.split(/(\n|\t)/).map((part) => part === "\n" ? "<w:br/>" : part === "\t" ? "<w:tab/>" : `<w:t xml:space="preserve">${encodeXml(part)}</w:t>`).join("") };
  });
  for (const token of replacements.reverse()) {
    if (token.replacement !== undefined) xml = xml.slice(0, token.start) + token.replacement + xml.slice(token.end);
  }
  return xml;
}

export function buildLetterTokens(site, publicLink) {
  const mode = ["legal-owner", "title-owner", "plot-land"].includes(site?.letterRecipientMode)
    ? site.letterRecipientMode
    : "legal-owner";
  const landAddress = cleanText(site?.landAddress);
  const targetAddress = mode === "plot-land"
    ? landAddress || cleanText(site?.plotDescription) || cleanText(site?.siteAddress)
    : cleanText(site?.siteAddress);
  const address = mode === "plot-land" && landAddress
    ? parseTrackingAddress(landAddress)
    : normalizeAddressParts(site?.siteAddressParts, targetAddress);
  const titledOwnerName = cleanText(site?.customerName) || cleanText(site?.ownerContactName) || "The Legal Owner";
  const legalName = mode === "title-owner" ? titledOwnerName : "The Legal Owner";
  const council = cleanText(site?.siteAddressParts?.county) || cleanText(site?.council?.councilName) || cleanText(site?.region);
  const streetAddress = [address.line1, address.line2].filter(Boolean).join(", ");
  const allAddress = buildAddressFromParts(address) || targetAddress.replace(/\s*,\s*/g, ", ");
  const siteAddress = cleanText(publicTrackingAddress(site ?? {}).siteAddress).replace(/\s*,\s*/g, ", ");
  const generatedDate = formatLetterDate(new Date());

  return new Map([
    ["{{legal_name}}", legalName],
    ["{{owner_name}}", legalName],
    ["{{customer_name}}", legalName],
    ["{{address}}", streetAddress],
    ["{{full_address}}", allAddress],
    ["{{site_address}}", siteAddress],
    ["{{plot_description}}", cleanText(site?.plotDescription) || siteAddress],
    ["{{street}}", address.line1],
    ["{{address_line_1}}", address.line1],
    ["{{address_line_2}}", address.line2],
    ["{{address_line_3}}", address.county],
    ["{{town}}", address.town],
    ["{{city}}", address.town],
    ["{{county}}", address.county],
    ["{{postal_code}}", address.postcode],
    ["{{postcode}}", address.postcode],
    ["{{council}}", council],
    ["{{title_number}}", cleanText(site?.titleNumber)],
    ["{{reference}}", cleanText(site?.reference)],
    ["{{date}}", generatedDate],
    ["{{letter_date}}", generatedDate],
    ["{{tracking_link}}", publicLink || ""]
  ]);
}

export function replacePlaceholdersInWordXml(xml, replacements) {
  // A deliberately blank second address line must not leave a gap in a letter.
  xml = xml.replace(/<w:p\b[^>]*>[\s\S]*?<\/w:p>/g, (paragraph) => {
    const text = [...paragraph.matchAll(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g)].map((match) => decodeXml(match[1])).join("").trim();
    return ["{{address_line_2}}", "{{county}}", "{{address_line_3}}"].includes(text) && replacements.get(text) === "" ? "" : paragraph;
  });
  const nodes = [];
  let match;

  while ((match = textNodePattern.exec(xml))) {
    nodes.push({
      start: match.index,
      contentStart: match.index + match[0].indexOf(match[1]),
      contentEnd: match.index + match[0].indexOf(match[1]) + match[1].length,
      end: match.index + match[0].length,
      text: decodeXml(match[1])
    });
  }

  for (const [token, value] of replacements) {
    let guard = 0;
    while (guard < 100) {
      guard += 1;
      const positions = indexTextNodes(nodes);
      const fullText = positions.map((item) => item.node.text).join("");
      const index = fullText.indexOf(token);
      if (index === -1) {
        break;
      }
      replaceNodeRange(nodes, positions, index, index + token.length, value);
    }
  }

  let nextXml = "";
  let cursor = 0;
  for (const node of nodes) {
    nextXml += xml.slice(cursor, node.contentStart);
    nextXml += encodeXml(node.text);
    cursor = node.contentEnd;
  }
  nextXml += xml.slice(cursor);
  return nextXml;
}

function readZip(buffer) {
  const source = Buffer.from(buffer);
  const eocdOffset = findEndOfCentralDirectory(source);
  const entryCount = source.readUInt16LE(eocdOffset + 10);
  const centralDirectoryOffset = source.readUInt32LE(eocdOffset + 16);
  const entries = [];
  let offset = centralDirectoryOffset;
  let uncompressedBytes = 0;

  if (entryCount > maxDocxEntries) {
    throw new Error("DOCX template contains too many files.");
  }

  if (centralDirectoryOffset >= source.length) {
    throw new Error("DOCX central directory is outside the file.");
  }

  for (let index = 0; index < entryCount; index += 1) {
    if (offset + 46 > source.length) {
      throw new Error("DOCX central directory is truncated.");
    }

    if (source.readUInt32LE(offset) !== 0x02014b50) {
      throw new Error("DOCX central directory is invalid.");
    }

    const method = source.readUInt16LE(offset + 10);
    const compressedSize = source.readUInt32LE(offset + 20);
    const filenameLength = source.readUInt16LE(offset + 28);
    const extraLength = source.readUInt16LE(offset + 30);
    const commentLength = source.readUInt16LE(offset + 32);
    const localHeaderOffset = source.readUInt32LE(offset + 42);
    const name = source.subarray(offset + 46, offset + 46 + filenameLength).toString("utf8");

    if (offset + 46 + filenameLength + extraLength + commentLength > source.length) {
      throw new Error("DOCX central directory entry is truncated.");
    }

    if (localHeaderOffset + 30 > source.length || source.readUInt32LE(localHeaderOffset) !== 0x04034b50) {
      throw new Error(`DOCX entry ${name || index} has an invalid local header.`);
    }

    const localNameLength = source.readUInt16LE(localHeaderOffset + 26);
    const localExtraLength = source.readUInt16LE(localHeaderOffset + 28);
    const dataStart = localHeaderOffset + 30 + localNameLength + localExtraLength;
    const dataEnd = dataStart + compressedSize;
    if (dataStart > source.length || dataEnd > source.length) {
      throw new Error(`DOCX entry ${name || index} is truncated.`);
    }

    const compressedData = source.subarray(dataStart, dataStart + compressedSize);
    const data = method === 0
      ? Buffer.from(compressedData)
      : method === 8
        ? inflateRawSync(compressedData, { maxOutputLength: maxDocxEntryBytes })
        : null;

    if (!data) {
      throw new Error(`DOCX entry ${name} uses unsupported compression method ${method}.`);
    }

    if (data.length > maxDocxEntryBytes) {
      throw new Error(`DOCX entry ${name || index} is too large.`);
    }

    uncompressedBytes += data.length;
    if (uncompressedBytes > maxDocxUncompressedBytes) {
      throw new Error("DOCX template expands to too much data.");
    }

    entries.push({ name, data, method });
    offset += 46 + filenameLength + extraLength + commentLength;
  }

  return entries;
}

function writeZip(entries) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  const now = dateToDos(new Date());

  for (const entry of entries) {
    const name = Buffer.from(entry.name, "utf8");
    const data = Buffer.from(entry.data);
    const isDirectory = entry.name.endsWith("/");
    const method = isDirectory ? 0 : 8;
    const compressed = method === 0 ? data : deflateRawSync(data);
    const crc = crc32(data);

    const local = Buffer.alloc(30 + name.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(method, 8);
    local.writeUInt16LE(now.time, 10);
    local.writeUInt16LE(now.date, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    name.copy(local, 30);
    localParts.push(local, compressed);

    const central = Buffer.alloc(46 + name.length);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(method, 10);
    central.writeUInt16LE(now.time, 12);
    central.writeUInt16LE(now.date, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    name.copy(central, 46);
    centralParts.push(central);

    offset += local.length + compressed.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, centralDirectory, end]);
}

function findEndOfCentralDirectory(source) {
  const minOffset = Math.max(0, source.length - 65_558);
  for (let offset = source.length - 22; offset >= minOffset; offset -= 1) {
    if (source.readUInt32LE(offset) === 0x06054b50) {
      return offset;
    }
  }
  throw new Error("DOCX end-of-central-directory marker was not found.");
}

function findQrMediaTarget(entries) {
  const documentEntry = entries.find((entry) => entry.name === "word/document.xml");
  const relsEntry = entries.find((entry) => entry.name === "word/_rels/document.xml.rels");
  if (!documentEntry || !relsEntry) {
    return "";
  }

  const rels = new Map();
  const relXml = relsEntry.data.toString("utf8");
  let relMatch;
  while ((relMatch = wordRelationshipPattern.exec(relXml))) {
    const relationship = relMatch[0];
    if (!/Type="[^"]*\/image"/.test(relationship)) {
      continue;
    }

    const id = relationship.match(/\bId="([^"]+)"/)?.[1];
    const target = relationship.match(/\bTarget="([^"]+)"/)?.[1];
    if (id && target) {
      rels.set(id, normalizeWordTarget(target));
    }
  }

  const candidates = [];
  const documentXml = documentEntry.data.toString("utf8");
  for (const drawing of documentXml.matchAll(/<w:drawing>[\s\S]*?<\/w:drawing>/g)) {
    const snippet = drawing[0];
    const markedEmbed = snippet.match(/r:embed="([^"]+)"/)?.[1];
    if (/\b(?:descr|title|name)="KINGSVALE_QR"/i.test(snippet) && markedEmbed) {
      const markedTarget = rels.get(markedEmbed);
      if (markedTarget?.endsWith(".png")) return markedTarget;
    }
    const extent = snippet.match(/<wp:extent cx="(\d+)" cy="(\d+)"/);
    const embed = snippet.match(/r:embed="([^"]+)"/);
    if (!extent || !embed) {
      continue;
    }

    const width = Number(extent[1]);
    const height = Number(extent[2]);
    const ratio = width / height;
    const target = rels.get(embed[1]);
    if (!target || !target.endsWith(".png")) {
      continue;
    }

    const widthInches = width / 914400;
    const heightInches = height / 914400;
    const squareish = ratio > 0.82 && ratio < 1.18;
    const qrSized = widthInches >= 0.75 && widthInches <= 2.2 && heightInches >= 0.75 && heightInches <= 2.2;
    if (squareish && qrSized) {
      candidates.push({ target, area: widthInches * heightInches, ratioDelta: Math.abs(1 - ratio) });
    }
  }

  candidates.sort((left, right) => left.ratioDelta - right.ratioDelta || right.area - left.area);
  return candidates[0]?.target ?? "";
}

function findFallbackQrMedia(entries) {
  const candidates = entries
    .filter((entry) => entry.name.startsWith("word/media/") && entry.name.endsWith(".png"))
    .map((entry) => ({ entry, dimensions: readPngDimensions(entry.data) }))
    .filter(({ dimensions }) => dimensions && dimensions.width > 32 && dimensions.height > 32)
    .filter(({ dimensions }) => {
      const ratio = dimensions.width / dimensions.height;
      return ratio > 0.82 && ratio < 1.18;
    })
    .sort((left, right) => (right.dimensions.width * right.dimensions.height) - (left.dimensions.width * left.dimensions.height));

  return candidates[0]?.entry.name ?? "";
}

function normalizeWordTarget(target) {
  const withoutPrefix = target.replace(/^\.\.\//, "");
  return withoutPrefix.startsWith("word/") ? withoutPrefix : `word/${withoutPrefix}`;
}

function readPngDimensions(data) {
  if (
    data.length < 24 ||
    data.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a"
  ) {
    return null;
  }

  return {
    width: data.readUInt32BE(16),
    height: data.readUInt32BE(20)
  };
}

function indexTextNodes(nodes) {
  let cursor = 0;
  return nodes.map((node) => {
    const start = cursor;
    cursor += node.text.length;
    return { node, start, end: cursor };
  });
}

function replaceNodeRange(nodes, positions, start, end, value) {
  const affected = positions.filter((position) => position.end > start && position.start < end);
  if (affected.length === 0) {
    return;
  }

  const first = affected[0];
  const last = affected.at(-1);
  const prefix = first.node.text.slice(0, Math.max(0, start - first.start));
  const suffix = last.node.text.slice(Math.max(0, end - last.start));

  if (first.node === last.node) {
    first.node.text = `${prefix}${value}${suffix}`;
    return;
  }

  first.node.text = `${prefix}${value}`;
  for (const position of affected.slice(1, -1)) {
    position.node.text = "";
  }
  last.node.text = suffix;
  void nodes;
}

function parseAddress(value) {
  const text = cleanText(value);
  const postcode = extractPostcode(text);
  const withoutPostcode = postcode ? text.replace(new RegExp(`${escapeRegExp(postcode)}\\s*$`, "i"), "").trim() : text;
  const parts = withoutPostcode
    .split(/\s*,\s*|\n+/)
    .map((part) => part.trim())
    .filter(Boolean);

  return {
    line1: parts[0] ?? "",
    line2: parts.length > 3 ? parts.slice(1, -2).join(", ") : parts.length === 3 ? parts[1] ?? "" : "",
    town: parts.length > 3 ? parts.at(-2) ?? "" : parts.length > 1 ? parts.at(-1) ?? "" : "",
    county: parts.length > 3 ? parts.at(-1) ?? "" : "",
    postcode
  };
}

function extractPostcode(value) {
  return cleanText(value).toUpperCase().match(/\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/)?.[0] ?? "";
}

function cleanText(value) {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

function normalizeAddressParts(parts = {}, fallbackAddress = "") {
  const parsed = parseAddress(fallbackAddress);
  return {
    line1: typeof parts?.line1 === "string" ? cleanText(parts.line1) : parsed.line1,
    line2: typeof parts?.line2 === "string" ? cleanText(parts.line2) : parsed.line2,
    town: typeof parts?.town === "string" ? cleanText(parts.town) : parsed.town,
    county: typeof parts?.county === "string" ? cleanText(parts.county) : parsed.county,
    postcode: (typeof parts?.postcode === "string" ? cleanText(parts.postcode) : parsed.postcode).toUpperCase()
  };
}

function buildAddressFromParts(parts = {}) {
  return [
    parts.line1,
    parts.line2,
    parts.town,
    parts.county,
    parts.postcode
  ]
    .map((part) => cleanText(part))
    .filter(Boolean)
    .join(", ");
}

function formatLetterDate(date) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/London"
  }).format(date);
}

function encodeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function decodeXml(value) {
  return String(value)
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", "\"")
    .replaceAll("&apos;", "'")
    .replaceAll("&amp;", "&");
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function dateToDos(date) {
  const year = Math.max(1980, date.getFullYear());
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
    date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate()
  };
}

const crcTable = new Uint32Array(256);
for (let index = 0; index < 256; index += 1) {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  crcTable[index] = value >>> 0;
}

function crc32(data) {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
