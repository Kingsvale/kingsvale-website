import type {
  TrackingMilestone,
  TrackingMilestoneState,
  TrackingQrDotStyle,
  TrackingQrFinderStyle,
  TrackingQrFrameStyle,
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
  reference: 64,
  summary: 240,
  statusNote: 320,
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
const qrDotStyles: TrackingQrDotStyle[] = ["square", "rounded", "circle"];
const qrFinderStyles: TrackingQrFinderStyle[] = ["square", "rounded", "circle"];
const qrFrameStyles: TrackingQrFrameStyle[] = ["square", "rounded", "cut-corner"];
const resourceTypes: TrackingResourceType[] = ["image", "document", "link"];

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
  addOptionalTextError(errors, "reference", site.reference, "Reference", trackingFieldLimits.reference);
  addOptionalTextError(errors, "summary", site.summary, "Summary", trackingFieldLimits.summary);
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

  return {
    valid: errors.length === 0,
    errors
  };
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
  if (!qrDotStyles.includes(site.qrStyle.dotStyle)) {
    errors.push({ path: "qrStyle.dotStyle", message: "Choose an approved QR dot style." });
  }
  if (!qrFinderStyles.includes(site.qrStyle.finderStyle)) {
    errors.push({ path: "qrStyle.finderStyle", message: "Choose an approved QR finder shape." });
  }
  if (!qrFrameStyles.includes(site.qrStyle.frameStyle)) {
    errors.push({ path: "qrStyle.frameStyle", message: "Choose an approved QR frame shape." });
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

function isHexColor(value: string) {
  return /^#[0-9a-fA-F]{6}$/.test(value);
}
