import { deflateRawSync, inflateRawSync } from "node:zlib";
import sharp from "sharp";
import { buildStyledQrSvg, safeColor, WORD_QR_EXPORT_SIZE } from "../src/lib/trackingQrSvg.js";

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

export function buildLetterTokens(site, publicLink) {
  const mode = ["legal-owner", "title-owner", "plot-land"].includes(site?.letterRecipientMode)
    ? site.letterRecipientMode
    : "legal-owner";
  const targetAddress = mode === "plot-land"
    ? cleanText(site?.plotDescription) || cleanText(site?.siteAddress)
    : cleanText(site?.siteAddress);
  const address = normalizeAddressParts(site?.siteAddressParts, targetAddress);
  const titledOwnerName = cleanText(site?.customerName) || cleanText(site?.ownerContactName) || "The Legal Owner";
  const legalName = mode === "title-owner" ? titledOwnerName : "The Legal Owner";
  const council = cleanText(site?.siteAddressParts?.county) || cleanText(site?.council?.councilName) || cleanText(site?.region);
  const streetAddress = [address.line1, address.line2].filter(Boolean).join(", ");
  const allAddress = buildAddressFromParts(address) || targetAddress.replace(/\s*,\s*/g, ", ");
  const siteAddress = cleanText(site?.siteAddress).replace(/\s*,\s*/g, ", ");
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
        ? inflateRawSync(compressedData)
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
    line1: cleanText(parts?.line1) || parsed.line1,
    line2: cleanText(parts?.line2) || parsed.line2,
    town: cleanText(parts?.town) || parsed.town,
    county: cleanText(parts?.county) || parsed.county,
    postcode: (cleanText(parts?.postcode) || parsed.postcode).toUpperCase()
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
