import type { ContactPriority, MailingStatus, TrackingQrStyle, TrackingSite } from "./trackingTypes";
import { boundedPercent, presetRoundness } from "./qrStyle";

type LegacyQrStyle = Partial<TrackingQrStyle> & {
  dotStyle?: string;
  finderStyle?: string;
  frameStyle?: string;
};

export function normalizeTrackingSite(site: TrackingSite): TrackingSite {
  const qrStyle = (site.qrStyle ?? {}) as LegacyQrStyle;
  const defaultStyle = defaultQrStyle();
  const firstMailedAt = site.firstMailedAt ?? "";
  const remailReminderDays = boundedReminderDays(site.remailReminderDays);
  return {
    ...site,
    region: site.region || detectSiteRegion(site.siteAddress) || "Uncategorised",
    ownerContactName: site.ownerContactName ?? "",
    contactPriority: normalizeContactPriority(site.contactPriority),
    mapEmbedUrl: normalizeMapEmbedInput(site.mapEmbedUrl ?? ""),
    privateNotes: site.privateNotes ?? "",
    letterFileName: site.letterFileName ?? "",
    letterFileUrl: site.letterFileUrl ?? "",
    searchlandUrl: site.searchlandUrl ?? "",
    resources: Array.isArray(site.resources) ? site.resources : [],
    qrStyle: {
      foreground: qrStyle.foreground ?? defaultStyle.foreground,
      background: qrStyle.background ?? defaultStyle.background,
      accent: qrStyle.accent ?? defaultStyle.accent,
      dotRoundness: boundedPercent(qrStyle.dotRoundness, presetRoundness(qrStyle.dotStyle)),
      finderRoundness: boundedPercent(qrStyle.finderRoundness, presetRoundness(qrStyle.finderStyle)),
      frameRoundness: boundedPercent(qrStyle.frameRoundness, qrStyle.frameStyle === "square" ? 0 : 42),
      frameCut: boundedPercent(qrStyle.frameCut, qrStyle.frameStyle === "cut-corner" ? 36 : 0),
      frameLabel: qrStyle.frameLabel ?? defaultStyle.frameLabel,
      includeLogo: qrStyle.includeLogo ?? defaultStyle.includeLogo
    },
    council: {
      mode: site.council?.mode ?? "none",
      councilName: site.council?.councilName ?? "",
      applicationReference: site.council?.applicationReference ?? "",
      apiBaseUrl: site.council?.apiBaseUrl ?? "",
      lastCheckedAt: site.council?.lastCheckedAt ?? null,
      lastSyncStatus: site.council?.lastSyncStatus ?? "Not configured"
    },
    mailingStatus: normalizeMailingStatus(site.mailingStatus),
    firstMailedAt,
    lastMailedAt: site.lastMailedAt ?? "",
    royalMailTrackingNumber: site.royalMailTrackingNumber ?? "",
    trackingStatus: site.trackingStatus ?? "Tracking unavailable",
    trackingLastCheckedAt: site.trackingLastCheckedAt ?? null,
    remailReminderDays,
    remailReminderDate: site.remailReminderDate || suggestRemailReminderDate(firstMailedAt, remailReminderDays),
    mailingNotes: site.mailingNotes ?? "",
    mailingLastUpdatedAt: site.mailingLastUpdatedAt ?? site.updatedAt ?? new Date().toISOString()
  };
}

export function defaultQrStyle(): TrackingQrStyle {
  return {
    foreground: "#22211d",
    background: "#fbf8f2",
    accent: "#ad9576",
    dotRoundness: 48,
    finderRoundness: 24,
    frameRoundness: 42,
    frameCut: 0,
    frameLabel: "Scan to view the plot",
    includeLogo: true
  };
}

export function normalizeMapEmbedInput(value: string) {
  const trimmed = value.trim();
  const iframeSrc = trimmed.match(/<iframe[^>]+src=["']([^"']+)["']/i)?.[1];
  return preferSatelliteMap(decodeHtmlAttribute(iframeSrc ?? trimmed));
}

export function detectSiteRegion(address: string) {
  const text = address.toLowerCase();
  const knownRegions = [
    "Wokingham",
    "Hampshire",
    "Berkshire",
    "Surrey",
    "London",
    "Reading",
    "Guildford",
    "Winchester",
    "Bracknell",
    "Basingstoke",
    "Hart"
  ];
  return knownRegions.find((region) => text.includes(region.toLowerCase())) ?? "";
}

export function suggestRemailReminderDate(firstMailedAt: string, reminderDays = 14) {
  if (!firstMailedAt) {
    return "";
  }

  const date = new Date(`${firstMailedAt}T12:00:00`);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  date.setDate(date.getDate() + boundedReminderDays(reminderDays));
  return date.toISOString().slice(0, 10);
}

function preferSatelliteMap(value: string) {
  if (!value) {
    return "";
  }

  try {
    const url = new URL(value);
    if (url.hostname === "www.google.com" && url.pathname.includes("/maps/d/embed")) {
      // Google My Maps embeds do not reliably expose a documented satellite default.
      // This is the closest safe hint and is preserved when the embed supports it.
      url.searchParams.set("basemap", "satellite");
      return url.toString();
    }
  } catch {
    return value;
  }

  return value;
}

function decodeHtmlAttribute(value: string) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", "\"")
    .replaceAll("&#39;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");
}

function normalizeContactPriority(value: ContactPriority | undefined): ContactPriority {
  return ["high", "medium", "low", "do-not-contact", "unknown"].includes(value ?? "")
    ? value as ContactPriority
    : "unknown";
}

function normalizeMailingStatus(value: MailingStatus | undefined): MailingStatus {
  return [
    "not-mailed",
    "ready-to-mail",
    "mailed",
    "delivered",
    "responded",
    "no-response",
    "second-letter-needed",
    "do-not-contact"
  ].includes(value ?? "")
    ? value as MailingStatus
    : "not-mailed";
}

function boundedReminderDays(value: number | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? Math.min(120, Math.max(1, Math.trunc(value))) : 14;
}
