import type {
  ContactPriority,
  MailingStatus,
  LetterRecipientMode,
  TrackingMilestone,
  TrackingMilestoneState,
  TrackingResource,
  TrackingResourceType,
  TrackingSite,
  TrackingStatus
} from "./trackingTypes";

export type TrackingValidationError = {
  path: string;
  message: string;
};

export type TrackingValidationResult = {
  valid: boolean;
  errors: TrackingValidationError[];
};

export const trackingFieldLimits = {
  token: 40,
  title: 72,
  customerName: 80,
  siteAddress: 160,
  addressLine1: 90,
  addressLine2: 90,
  addressTown: 70,
  addressCounty: 70,
  addressPostcode: 12,
  ownerAddress: 220,
  titleNumber: 80,
  plotDescription: 220,
  reference: 64,
  region: 80,
  mapEmbedUrl: 1200,
  privateNotes: 1200,
  letterPresetId: 120,
  titleDeedFileName: 160,
  titleDeedFileUrl: 7_000_000,
  letterTemplateName: 160,
  letterTemplateUrl: 7_000_000,
  letterFileName: 160,
  letterFileUrl: 7_000_000,
  searchlandUrl: 1200,
  statusNote: 320,
  royalMailTrackingNumber: 40,
  trackingStatus: 140,
  mailingNotes: 1200,
  councilName: 90,
  applicationReference: 80,
  apiBaseUrl: 180,
  milestoneLabel: 72,
  milestoneNote: 180,
  qrFrameLabel: 46,
  resourceTitle: 80,
  resourceUrl: 900,
  resourceNote: 180
} as const;

const trackingStatuses: TrackingStatus[] = [
  "planning",
  "submitted",
  "in-review",
  "approved",
  "construction",
  "complete",
  "on-hold"
];

const milestoneStates: TrackingMilestoneState[] = ["pending", "active", "complete", "blocked"];
const resourceTypes: TrackingResourceType[] = ["image", "document", "link"];
const contactPriorities: ContactPriority[] = ["high", "medium", "low", "do-not-contact", "unknown"];
const mailingStatuses: MailingStatus[] = [
  "not-mailed",
  "ready-to-mail",
  "mailed",
  "delivered",
  "responded",
  "no-response",
  "second-letter-needed",
  "do-not-contact"
];
const letterRecipientModes: LetterRecipientMode[] = ["legal-owner", "title-owner", "plot-land"];

export function validateTrackingSite(site: TrackingSite): TrackingValidationResult {
  const errors: TrackingValidationError[] = [];

  if (!site || typeof site !== "object") {
    return { valid: false, errors: [{ path: "site", message: "Tracking site is required." }] };
  }

  addTokenError(errors, site.token);
  addRequiredTextError(errors, "title", site.title, "Site title", trackingFieldLimits.title);
  addOptionalTextError(
    errors,
    "customerName",
    site.customerName,
    "Customer name",
    trackingFieldLimits.customerName
  );
  addRequiredTextError(
    errors,
    "siteAddress",
    site.siteAddress,
    "Site address",
    trackingFieldLimits.siteAddress
  );
  addRequiredTextError(
    errors,
    "siteAddressParts.line1",
    site.siteAddressParts?.line1,
    "Address line 1",
    trackingFieldLimits.addressLine1
  );
  addOptionalTextError(
    errors,
    "siteAddressParts.line2",
    site.siteAddressParts?.line2,
    "Address line 2",
    trackingFieldLimits.addressLine2
  );
  addRequiredTextError(
    errors,
    "siteAddressParts.town",
    site.siteAddressParts?.town,
    "Town or city",
    trackingFieldLimits.addressTown
  );
  addOptionalTextError(
    errors,
    "siteAddressParts.county",
    site.siteAddressParts?.county,
    "Council",
    trackingFieldLimits.addressCounty
  );
  addRequiredTextError(
    errors,
    "siteAddressParts.postcode",
    site.siteAddressParts?.postcode,
    "Postcode",
    trackingFieldLimits.addressPostcode
  );
  if (site.siteAddressParts?.postcode && !/^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i.test(site.siteAddressParts.postcode.trim())) {
    errors.push({ path: "siteAddressParts.postcode", message: "Use a valid UK postcode." });
  }
  addOptionalTextError(errors, "reference", site.reference, "Reference", trackingFieldLimits.reference);
  addOptionalTextError(errors, "region", site.region, "Region", trackingFieldLimits.region);
  addOptionalTextError(
    errors,
    "ownerAddress",
    site.ownerAddress,
    "Owner postal address",
    trackingFieldLimits.ownerAddress
  );
  addOptionalTextError(errors, "titleNumber", site.titleNumber, "Title number", trackingFieldLimits.titleNumber);
  addOptionalTextError(
    errors,
    "plotDescription",
    site.plotDescription,
    "Plot description",
    trackingFieldLimits.plotDescription
  );
  if (!contactPriorities.includes(site.contactPriority)) {
    errors.push({ path: "contactPriority", message: "Choose an approved contact priority." });
  }
  addOptionalTextError(errors, "mapEmbedUrl", site.mapEmbedUrl, "Google My Maps embed URL", trackingFieldLimits.mapEmbedUrl);
  if (site.mapEmbedUrl && !isValidMapEmbedUrl(site.mapEmbedUrl)) {
    errors.push({
      path: "mapEmbedUrl",
      message: "Google My Maps embed must be a safe Google Maps, Google My Maps or Google Earth URL."
    });
  }
  addOptionalTextError(errors, "privateNotes", site.privateNotes, "Private note", trackingFieldLimits.privateNotes);
  addOptionalTextError(
    errors,
    "letterPresetId",
    site.letterPresetId,
    "Letter preset",
    trackingFieldLimits.letterPresetId
  );
  if (!letterRecipientModes.includes(site.letterRecipientMode)) {
    errors.push({ path: "letterRecipientMode", message: "Choose an approved letter recipient mode." });
  }
  addOptionalTextError(errors, "titleDeedFileName", site.titleDeedFileName, "Title deed filename", trackingFieldLimits.titleDeedFileName);
  if (site.titleDeedFileUrl && (site.titleDeedFileUrl.length > trackingFieldLimits.titleDeedFileUrl || !isValidLetterUrl(site.titleDeedFileUrl))) {
    errors.push({
      path: "titleDeedFileUrl",
      message: "Title deed upload must be a PDF, image or Word document under the upload limit."
    });
  }
  addOptionalTextError(
    errors,
    "letterTemplateName",
    site.letterTemplateName,
    "Letter template filename",
    trackingFieldLimits.letterTemplateName
  );
  if (
    site.letterTemplateUrl &&
    (
      site.letterTemplateUrl.length > trackingFieldLimits.letterTemplateUrl ||
      !isValidLetterTemplateUrl(site.letterTemplateUrl)
    )
  ) {
    errors.push({
      path: "letterTemplateUrl",
      message: "Letter template must be a safe Word document upload."
    });
  }
  addOptionalTextError(errors, "letterFileName", site.letterFileName, "Letter filename", trackingFieldLimits.letterFileName);
  if (site.letterFileUrl && (site.letterFileUrl.length > trackingFieldLimits.letterFileUrl || !isValidLetterUrl(site.letterFileUrl))) {
    errors.push({
      path: "letterFileUrl",
      message: "Letter upload must be a PDF, image or Word document under the upload limit."
    });
  }
  addOptionalTextError(errors, "searchlandUrl", site.searchlandUrl, "Searchland URL", trackingFieldLimits.searchlandUrl);
  if (site.searchlandUrl && !isValidSearchlandUrl(site.searchlandUrl)) {
    errors.push({ path: "searchlandUrl", message: "Searchland URL must be a safe Searchland link." });
  }
  addRequiredTextError(
    errors,
    "statusNote",
    site.statusNote,
    "Status note",
    trackingFieldLimits.statusNote
  );

  if (!trackingStatuses.includes(site.currentStatus)) {
    errors.push({ path: "currentStatus", message: "Choose an approved status." });
  }

  if (!Array.isArray(site.milestones) || site.milestones.length < 1 || site.milestones.length > 8) {
    errors.push({ path: "milestones", message: "Use between one and eight milestones." });
  } else {
    site.milestones.forEach((milestone, index) =>
      addMilestoneErrors(errors, milestone, index)
    );
  }

  addQrStyleErrors(errors, site);

  if (!Array.isArray(site.resources) || site.resources.length > 8) {
    errors.push({ path: "resources", message: "Use up to eight customer resources." });
  } else {
    site.resources.forEach((resource, index) =>
      addResourceErrors(errors, resource, index)
    );
  }

  if (site.council.mode !== "none" && site.council.mode !== "configured") {
    errors.push({ path: "council.mode", message: "Choose a council sync mode." });
  }

  addOptionalTextError(
    errors,
    "council.councilName",
    site.council.councilName,
    "Council name",
    trackingFieldLimits.councilName
  );
  addOptionalTextError(
    errors,
    "council.applicationReference",
    site.council.applicationReference,
    "Application reference",
    trackingFieldLimits.applicationReference
  );

  if (site.council.mode === "configured") {
    addRequiredTextError(
      errors,
      "council.councilName",
      site.council.councilName,
      "Council name",
      trackingFieldLimits.councilName
    );
    addRequiredTextError(
      errors,
      "council.applicationReference",
      site.council.applicationReference,
      "Application reference",
      trackingFieldLimits.applicationReference
    );
  }

  if (site.council.apiBaseUrl && !isValidHttpUrl(site.council.apiBaseUrl)) {
    errors.push({ path: "council.apiBaseUrl", message: "Council API URL must be an HTTP URL." });
  }

  addMailingErrors(errors, site);

  return {
    valid: errors.length === 0,
    errors
  };
}

function addMailingErrors(errors: TrackingValidationError[], site: TrackingSite) {
  if (!mailingStatuses.includes(site.mailingStatus)) {
    errors.push({ path: "mailingStatus", message: "Choose an approved mailing status." });
  }

  addOptionalTextError(
    errors,
    "royalMailTrackingNumber",
    site.royalMailTrackingNumber,
    "Royal Mail tracking number",
    trackingFieldLimits.royalMailTrackingNumber
  );
  addOptionalTextError(
    errors,
    "trackingStatus",
    site.trackingStatus,
    "Tracking status",
    trackingFieldLimits.trackingStatus
  );
  addOptionalTextError(
    errors,
    "mailingNotes",
    site.mailingNotes,
    "Mailing notes",
    trackingFieldLimits.mailingNotes
  );

  if (!Number.isFinite(site.remailReminderDays) || site.remailReminderDays < 1 || site.remailReminderDays > 120) {
    errors.push({ path: "remailReminderDays", message: "Reminder days must be between 1 and 120." });
  }

  for (const [path, value] of [
    ["firstMailedAt", site.firstMailedAt],
    ["lastMailedAt", site.lastMailedAt],
    ["remailReminderDate", site.remailReminderDate]
  ]) {
    if (value && !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      errors.push({ path, message: "Use a valid date." });
    }
  }
}

function addQrStyleErrors(errors: TrackingValidationError[], site: TrackingSite) {
  if (!site.qrStyle || typeof site.qrStyle !== "object") {
    errors.push({ path: "qrStyle", message: "QR style settings are required." });
    return;
  }

  if (!isHexColor(site.qrStyle.foreground)) {
    errors.push({ path: "qrStyle.foreground", message: "QR foreground must be a hex colour." });
  }
  if (!isHexColor(site.qrStyle.background)) {
    errors.push({ path: "qrStyle.background", message: "QR background must be a hex colour." });
  }
  if (!isHexColor(site.qrStyle.accent)) {
    errors.push({ path: "qrStyle.accent", message: "QR accent must be a hex colour." });
  }
  addNumberRangeError(errors, "qrStyle.dotRoundness", site.qrStyle.dotRoundness, "Dot roundness");
  addNumberRangeError(
    errors,
    "qrStyle.finderRoundness",
    site.qrStyle.finderRoundness,
    "Finder roundness"
  );
  addNumberRangeError(
    errors,
    "qrStyle.frameRoundness",
    site.qrStyle.frameRoundness,
    "Frame roundness"
  );
  addNumberRangeError(errors, "qrStyle.frameCut", site.qrStyle.frameCut, "Frame cut");
  addRequiredTextError(
    errors,
    "qrStyle.frameLabel",
    site.qrStyle.frameLabel,
    "QR label",
    trackingFieldLimits.qrFrameLabel
  );
}

function addNumberRangeError(
  errors: TrackingValidationError[],
  path: string,
  value: number,
  label: string
) {
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    errors.push({ path, message: `${label} must be between 0 and 100.` });
  }
}

function addResourceErrors(
  errors: TrackingValidationError[],
  resource: TrackingResource,
  index: number
) {
  const path = `resources.${index}`;
  addRequiredTextError(
    errors,
    `${path}.title`,
    resource.title,
    "Resource title",
    trackingFieldLimits.resourceTitle
  );
  addOptionalTextError(
    errors,
    `${path}.note`,
    resource.note,
    "Resource note",
    trackingFieldLimits.resourceNote
  );

  if (!resourceTypes.includes(resource.type)) {
    errors.push({ path: `${path}.type`, message: "Choose an approved resource type." });
  }

  if (!resource.url?.trim()) {
    errors.push({ path: `${path}.url`, message: "Resource URL is required." });
  } else if (resource.url.length > trackingFieldLimits.resourceUrl || !isValidResourceUrl(resource.url)) {
    errors.push({
      path: `${path}.url`,
      message: "Resource URL must be a safe HTTP URL, relative path or uploaded media path."
    });
  }
}

function addMilestoneErrors(
  errors: TrackingValidationError[],
  milestone: TrackingMilestone,
  index: number
) {
  const path = `milestones.${index}`;
  addRequiredTextError(
    errors,
    `${path}.label`,
    milestone.label,
    "Milestone label",
    trackingFieldLimits.milestoneLabel
  );
  addOptionalTextError(
    errors,
    `${path}.note`,
    milestone.note ?? "",
    "Milestone note",
    trackingFieldLimits.milestoneNote
  );

  if (!milestoneStates.includes(milestone.state)) {
    errors.push({ path: `${path}.state`, message: "Choose an approved milestone state." });
  }
}

function addTokenError(errors: TrackingValidationError[], token: string) {
  if (!/^[a-zA-Z0-9_-]{16,40}$/.test(token)) {
    errors.push({
      path: "token",
      message: "Tracking token must be an unguessable URL-safe value."
    });
  }
}

function addRequiredTextError(
  errors: TrackingValidationError[],
  path: string,
  value: string | undefined,
  label: string,
  limit: number
) {
  const text = value?.trim() ?? "";

  if (!text) {
    errors.push({ path, message: `${label} is required.` });
    return;
  }

  if (text.length > limit) {
    errors.push({ path, message: `${label} must be ${limit} characters or fewer.` });
  }
}

function addOptionalTextError(
  errors: TrackingValidationError[],
  path: string,
  value: string | undefined,
  label: string,
  limit: number
) {
  const text = value?.trim() ?? "";
  if (text.length > limit) {
    errors.push({ path, message: `${label} must be ${limit} characters or fewer.` });
  }
}

function isValidHttpUrl(value: string) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

function isValidResourceUrl(value: string) {
  if (value.startsWith("/media/") || value.startsWith("/assets/") || value.startsWith("/")) {
    return true;
  }

  return isValidHttpUrl(value);
}

function isValidMapEmbedUrl(value: string) {
  try {
    const parsed = new URL(value);
    return (
      (parsed.protocol === "https:" || parsed.protocol === "http:") &&
      (
        parsed.hostname === "www.google.com" ||
        parsed.hostname === "google.com" ||
        parsed.hostname.endsWith(".google.com") ||
        parsed.hostname === "earth.google.com" ||
        parsed.hostname.endsWith(".googleusercontent.com")
      )
    );
  } catch {
    return false;
  }
}

function isValidLetterUrl(value: string) {
  if (value.startsWith("/media/")) {
    return /\.(pdf|png|jpe?g|webp|docx?)$/i.test(value);
  }

  return /^data:(application\/pdf|image\/png|image\/jpeg|image\/webp|application\/msword|application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document);base64,[a-zA-Z0-9+/=]+$/.test(value);
}

function isValidLetterTemplateUrl(value: string) {
  if (value.startsWith("/media/")) {
    return /\.docx$/i.test(value);
  }

  return /^data:application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document;base64,[a-zA-Z0-9+/=]+$/.test(value);
}

function isValidSearchlandUrl(value: string) {
  try {
    const parsed = new URL(value);
    return (
      parsed.protocol === "https:" &&
      (parsed.hostname === "app.searchland.co.uk" || parsed.hostname.endsWith(".searchland.co.uk"))
    );
  } catch {
    return false;
  }
}

function isHexColor(value: string) {
  return /^#[0-9a-fA-F]{6}$/.test(value);
}
